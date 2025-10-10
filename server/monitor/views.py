import base64, json, datetime, traceback
import requests

from django.conf import settings
from django.db.models import CharField, Aggregate

from rest_framework import viewsets
from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response

from monitor.models import CustomBigScreen, CustomBigScreenBusCom, BigScreenAssociation
from monitor.serializers import BigScreenAssociationSerializer, CustomBigScreenListSerializer, CustomBigScreenSerializer, \
    CustomBigScreenBusComSerializer
from monitor.tasks import *

class GroupConcat(Aggregate):
    function = 'GROUP_CONCAT'
    template = '%(function)s(%(distinct)s%(expressions)s%(ordering)s%(separator)s)'

    def __init__(self, expression, distinct=False, ordering=None, separator=',', **extra):
        super(GroupConcat, self).__init__(
            expression,
            distinct='DISTINCT ' if distinct else '',
            ordering=' ORDER BY %s' % ordering if ordering is not None else '',
            separator=' SEPARATOR "%s"' % separator,
            output_field=CharField(),
            **extra
        )

class CustomBigScreenPublicViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = (permissions.AllowAny,)
    queryset = CustomBigScreen.objects.filter(ispublished=1)
    serializer_class = CustomBigScreenSerializer
    filterset_fields = ('id', 'name',)

class CustomBigScreenViewSet(viewsets.ModelViewSet):
    queryset = CustomBigScreen.objects.all()
    serializer_class = CustomBigScreenSerializer
    filterset_fields = ('id', 'name',)

    def update(self, request, *args, **kwargs):
        data = request.data.copy()
        if 'modifier' in data and data['modifier'] is not None and not isinstance(data['modifier'], str):
            data['modifier'] = str(data['modifier'])
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        self.perform_update(serializer)
        return Response(serializer.data)

class CustomBigScreenBusComViewSet(viewsets.ModelViewSet):
    queryset = CustomBigScreenBusCom.objects.all()
    serializer_class = CustomBigScreenBusComSerializer
    
class CustomBigScreenListViewSet(viewsets.ModelViewSet):
    queryset = CustomBigScreen.objects.all()
    serializer_class = CustomBigScreenListSerializer

    def list(self, request, *args, **kwargs):
        print("Queryset:", self.queryset)
        return super().list(request, *args, **kwargs)
    
def query_rows(sql,params=None):
    from django.db import connection
    with connection.cursor() as cursor:
        try:
            if params:
                cursor.execute(sql,params=params)
            else:
                cursor.execute(sql)
        except Exception as e:
            result = {'error': f'err in exec sql: {e}'}
            return result
        col_names = [desc[0] for desc in cursor.description]
        row = cursor.fetchall()
        rowList = []
        for list in row:
            map = dict(zip(col_names, list))
            rowList.append(map)
        return rowList

def query_onerow(sql,params=None):
    from django.db import connection
    with connection.cursor() as cursor:
        try:
            if params:
                cursor.execute(sql,params=params)
            else:
                cursor.execute(sql)
        except Exception as e:
            result = {'error': f'err in exec sql: {e}'}
            return result
        col_names = [desc[0] for desc in cursor.description]
        row = cursor.fetchone()
        map = dict(zip(col_names, row))
        return map

def checkSafeSql(sql):
    temp = sql.lower().split()
    for item in temp:
        if item == 'update' or item == 'drop' or item == 'delete':
            return False
    return True

# prometheus自定义查询接口
class CustomQueryViewSet(viewsets.ViewSet):
    permission_classes = (permissions.AllowAny,)

    def list(self, request, *args, **kwargs):
        query = request.query_params.get('query', None)
        type = request.query_params.get('type', 'table').lower() # default is table
        period = int(request.query_params.get('period', 1))
        step = int(request.query_params.get('step', 60))
        name = request.query_params.get('name', 'instance')
        prometheus_address = request.query_params.get('prometheus', settings.PROMETHEUS_ADDRESS)
        #prometheus_address = settings.PROMETHEUS_ADDRESS
        method = request.query_params.get('method', 'get').lower()
        strstart = request.query_params.get('start', '')
        strend = request.query_params.get('end', '')
        querytable = request.query_params.get('querytable', None) 

        label_name = request.query_params.get('label_name', None)  # 不返回指标value，返回具体标签的key
        multiple_name = request.query_params.get('multiple_name', None)
        # print(request.query_params)
        strvalue = "values"

        if query:
            prometheus_results = {"data": {"result": []}}
            query_list = query.split(' plus ')
            name_list = name.split(',')
            for idx, query in enumerate(query_list):
                # remove 1) querytable and 2) prom topn query
                if step > 0:
                    strvalue = "values"
                    end = datetime.datetime.now()
                    start = end - datetime.timedelta(hours=period)
                    if len(strstart) > 0:
                        start = datetime.datetime.strptime(strstart, '%Y-%m-%d %H:%M:%S')
                    if len(strend) > 0:
                        end = datetime.datetime.strptime(strend, '%Y-%m-%d %H:%M:%S')
                    period = (end - start).total_seconds() / 3600
                    time_categories = [start.timestamp() + step * x for x in range(int((end - start).total_seconds() / step )+1)]
                    url = prometheus_address + '/api/v1/query_range'
                    query = query + '&start=%s&end=%s&step=%s' % (int(start.timestamp()), int(end.timestamp()), step)
                elif step == -1:
                    import time
                    strvalue = "values"
                    #end = datetime.datetime.now()
                    thistime = time.localtime(time.time())
                    today = time.mktime(time.strptime(time.strftime('%Y-%m-%d 00:00:00', thistime), '%Y-%m-%d %H:%M:%S'))
                    #start = end - datetime.timedelta(hours=datetime.datetime.hour())
                    url = prometheus_address + '/api/v1/query'
                    query = query.replace('[]', '[%ss]' % (int(time.mktime(thistime)-today)))

                else:
                    url = prometheus_address + '/api/v1/query'
                    strvalue = "value"

                if method == 'post':
                    query = 'query=' + query
                    #print(query)
                    #print(url)
                    url = url.replace('+', '%2B')
                    header = {'Content-Type': 'application/x-www-form-urlencoded'}
                    result = json.loads(requests.post(url=url, headers=header, data=query.encode(), timeout=10).text)
                else:
                    url = url + '?query=' + query
                    url = url.replace('+', '%2B')
                    result = json.loads(requests.get(url, timeout=10).text)
                
                if len(query_list) > 1:
                    for node in result["data"]["result"]:
                        node['_formula_name'] = "formula_name"
                else:
                    if result['status'] == 'error':
                        return Response({'errorType': result['errorType'], 'error': result['error']}, status=status.HTTP_400_BAD_REQUEST)
                    for i, node in enumerate(result["data"]["result"]):
                        # print(node)
                        if multiple_name:
                            multiple_name_list = multiple_name.split("|")
                            if len(multiple_name_list) == len(result["data"]["result"]):
                                node['multiple_name'] = multiple_name_list[i]
                            else:
                                node['multiple_name'] = multiple_name

                        if len(name_list) == len(result["data"]["result"]):
                            node['_formula_name'] = name_list[i]
                        else:
                            node['_formula_name'] = "formula_name"

                prometheus_results['data']['result'].extend(result['data']['result'])
        elif querytable is None:
            return Response({"detail": '必须设置query或querytable参数'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if type == 'table':
                result = {"data": []}
                for node in prometheus_results["data"]["result"]:
                    if strvalue == 'values':
                        for v in node[strvalue]:
                            item = node["metric"]
                            item["datetime"] = datetime.datetime.fromtimestamp(v[0]).strftime("%Y-%m-%d %H:%M:%S")
                            item["value"] = v[1]
                            result["data"].append(item)
                            # result["data"].append({"datetime": datetime.datetime.fromtimestamp(v[0]), "value": v[1], "metric": node["metric"]})
                    else:
                        item = node["metric"]
                        if item.get("alertname", None):
                            alertname = item["alertname"].split('】')
                            item["alertname"] = alertname[len(alertname)-1]
                        item["datetime"] = datetime.datetime.fromtimestamp(node[strvalue][0]).strftime("%Y-%m-%d %H:%M:%S")
                        item["value"] = node[strvalue][1]
                        result["data"].append(item)
                        # result["data"].append({"datetime": datetime.datetime.fromtimestamp(node[strvalue][0]), "value": node[strvalue][1], "metric": node["metric"]})
            elif type == 'line':
                result = {"data": {
                                    "categories": [],
                                    "series": []}
                        }
                strToday = datetime.datetime.now().strftime("%m-%d ")
                for node in prometheus_results["data"]["result"]:
                    dataname = node['_formula_name']
                    if node.get('multiple_name'):
                        name_key_lists = node.get('multiple_name').lstrip('(').rstrip(")").split(",")
                        nodename = ''
                        for name_key in name_key_lists:
                            if name_key in node["metric"]:
                                nodename += "--" + node["metric"][name_key]
                        # dataname = node.get('multiple_name')
                        nodename = nodename.strip("--")
                    else:
                        if dataname in node["metric"]:
                            nodename = node["metric"][dataname]
                        else:
                            nodename = dataname
                    if node["values"]:
                        data = []
                        if period > 24:
                            strFormat = "%m-%d %H:%M:%S"
                        else:
                            strFormat = "%H:%M:%S"
                        
                        categories = [datetime.datetime.fromtimestamp(x).strftime(strFormat) for x in time_categories]
                        values = {datetime.datetime.fromtimestamp(x[0]).strftime(strFormat):x[1] for x in node["values"]}
                        for time in categories:
                            data.append(values.get(time, "0"))
        
                    result["data"]["categories"] = categories
                    result["data"]["series"].append({"name": nodename, "data": data})
            elif type == 'pie':
                result = {"data": []}
                for node in prometheus_results["data"]["result"]:
                    dataname = node['_formula_name']
                    if dataname in node["metric"]:
                        nodename = node["metric"][dataname]
                    else:
                        nodename = dataname
                    if "values" in node:
                        t = node["values"][len(node["values"])-1][0]
                        v = node["values"][len(node["values"])-1][1]
                    if "value" in node:
                        t = node["value"][0]
                        v = node["value"][1]
                    result["data"].append({"name": nodename, "value": v, "datetime": datetime.datetime.fromtimestamp(t)})
            elif type == 'radar':
                #暂时先按100%利用率的方式来定max，且只支持当前值，不支持时间序列值，
                result = {"data": {
                                    "indicator": [],
                                    "series": []}
                        }
                indicator = []
                data = []
                for node in prometheus_results["data"]["result"]:
                    dataname = node['_formula_name']
                    if dataname in node["metric"]:
                        nodename = node["metric"][dataname]
                    else:
                        nodename = dataname
                    if "values" in node:
                        v = node["values"][len(node["values"]) - 1][1]
                    if "value" in node:
                        v = node["value"][1]
                    data.append(v)
                    indicator.append({"name": nodename, "max": 100})
                result["data"]["indicator"] = indicator
                if formula_name:
                    nodename = formula_name
                else:
                    nodename = formula
                result["data"]["series"].append({"name": nodename, "data": data})
            elif type == 'progress':
                # 暂时先按100%利用率的方式来定data，且只支持当前值，不支持时间序列值，
                result = {}
                for node in prometheus_results["data"]["result"]:
                    dataname = node['_formula_name']
                    if dataname in node["metric"]:
                        nodename = node["metric"][dataname]
                    else:
                        nodename = dataname
                    if "values" in node:
                        t = node["values"][len(node["values"])-1][0]
                        v = node["values"][len(node["values"])-1][1]
                    if "value" in node:
                        t = node["value"][0]
                        v = node["value"][1]
                    result["data"] = {"label": nodename, "value": int(v), "datetime": datetime.datetime.fromtimestamp(t), "data": int(v)}
            elif type == 'data' or type == 'flop':
                result = {}
                if len(prometheus_results["data"]["result"]) > 0:
                    if label_name:
                        result["data"] = {"value": prometheus_results["data"]["result"][0]["metric"][label_name]}
                    else:
                        for node in prometheus_results["data"]["result"]:
                            if "values" in node:
                                v = node["values"][len(node["values"]) - 1]
                                result["data"] = {"datetime": datetime.datetime.fromtimestamp(v[0]), "value": v[1]}
                            if "value" in node:
                                result["data"] = {"datetime": datetime.datetime.fromtimestamp(node["value"][0]), "value": node["value"][1]}
                else:
                    #没有找到则设置为0
                    result["data"] = {"datetime": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                                      "value": 0}
            elif type == 'gauge':
                # 仪表盘 暂时先按100%利用率的方式来定data，且只支持当前值，不支持时间序列值，
                result = {"data": {"min": 1,"max": 100, "unit": "%"}}
                if formula_name:
                    nodename = formula_name
                else:
                    nodename = formula
                result["label"] = nodename
                for node in prometheus_results["data"]["result"]:
                    if "values" in node:
                        v = node["values"][len(node["values"]) - 1]
                        result["data"]["datetime"] = datetime.datetime.fromtimestamp(v[0])
                        result["data"]["value"] = v[1]
                        result["data"]["name"] = nodename
                    if "value" in node:
                        result["data"]["datetime"] = datetime.datetime.fromtimestamp(node["value"][0])
                        result["data"]["value"] = node["value"][1]
                        result["data"]["name"] = nodename
            elif type == 'else':
                result = []
                instance = []  # 用于过滤多余相同数据
                for node in prometheus_results["data"]["result"]:
                    if node['metric']['instance'] not in instance:
                        new_dict = {}
                        if "values" in node and len(node['values']) != 0:
                            new_dict['instance'] = node['metric']['instance']
                            new_dict['value'] = node['values'][-1]
                            instance.append(node['metric']['instance'])
                        elif "values" in node and len(node['values']) == 0:
                            new_dict['instance'] = node['metric']['instance']
                            new_dict['value'] = []
                            instance.append(node['metric']['instance'])

                        if "value" in node and len(node['value']) != 0:
                            new_dict['instance'] = node['metric']['instance']
                            new_dict['value'] = node['value'][-1]
                            instance.append(node['metric']['instance'])

                        elif "value" in node and len(node['values']) == 0:
                            new_dict['instance'] = node['metric']['instance']
                            new_dict['value'] = []
                            instance.append(node['metric']['instance'])
                        result.append(new_dict)

            elif type == 'for_lease_line':
                result = []
                for node in prometheus_results["data"]["result"]:
                    # if node['metric']['instance'] not in instance:
                    new_dict = {}
                    if "values" in node and len(node['values']) != 0:
                        new_dict['ip'] = node['metric']['ip']
                        new_dict['value'] = node['values'][-1]
                        new_dict['port_name'] = node['metric']['ifDescr']

                    elif "values" in node and len(node['values']) == 0:
                        new_dict['ip'] = node['metric']['ip']
                        new_dict['value'] = []
                        new_dict['port_name'] = node['metric']['ifDescr']

                    if "value" in node and len(node['value']) != 0:
                        new_dict['ip'] = node['metric']['ip']
                        new_dict['value'] = node['value'][-1]
                        new_dict['port_name'] = node['metric']['ifDescr']

                    elif "value" in node and len(node['values']) == 0:
                        new_dict['ip'] = node['metric']['ip']
                        new_dict['value'] = []
                        new_dict['port_name'] = node['metric']['ifDescr']
                    result.append(new_dict)
                        
        except Exception as e:
            print(traceback.format_exc())
            return Response({"detail": f'接口调用异常: {e}'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(result, status=status.HTTP_200_OK)

class GpuTop10(APIView):
    permission_classes = (permissions.AllowAny,)

    def get_data(self, _type, host_ip_list):
        result = []
        has_toward = False
        header = {'Content-Type':'application/json'}
        url = '{}/api/v1/query'.format(settings.PROMETHEUS_ADDRESS)
        query_str = [f'topk(10, DCGM_FI_DEV_POWER_USAGE{{ip=~"{host_ip_list}"}})']
        if _type == 'power':
            query_str = [f'topk(10, DCGM_FI_DEV_POWER_USAGE{{ip=~"{host_ip_list}"}})']
        elif _type == 'temprature':
            query_str = [f'topk(10, DCGM_FI_DEV_GPU_TEMP{{ip=~"{host_ip_list}"}})']
        elif _type == 'ib network':
            has_toward = True
            query_str = [f'topk(10, ib_network_transmit_rate:5m{{ip=~"{host_ip_list}"}})', f'topk(10, ib_network_recive_rate:5m{{ip=~"{host_ip_list}"}})']
        elif _type == 'normal network':
            has_toward = True
            query_str = [f'topk(10, network_upload_mbytes_per_seconds3m{{ip=~"{host_ip_list}"}}*8)', f'topk(10, network_download_mbytes_per_seconds3m{{ip=~"{host_ip_list}"}}*8)']
        for index, query in enumerate(query_str):
            data = {
                'query': query
            }
            res = requests.get(url, params=data,headers=header,timeout=10)
            result_data =res.json()['data']['result']
            if has_toward:
                if index ==0:
                    for item in result_data:
                        item['metric']['toward'] = '上行'
                else:
                    for item in result_data:
                        item['metric']['toward'] = '下行'
            result += result_data
        return result

    def get(self, request, *args, **kwargs):
        _type = request.query_params.get('type', '')
        # 增加取数的方式：1. PROJECT 2.LABEL
        _project_id = request.query_params.get('project_id', "").strip('"\'')
        _label_group_id = request.query_params.get('label_group_id', "").strip('"\'')
        
        result = []
        hosts = Host.objects.filter(status=1, asset_type="GPU Node")
        if _project_id and _project_id.isdigit():
            hosts = hosts.filter(product_id=_project_id)
            try:
                project_name = Product.objects.get(id=int(_project_id)).name
            except:
                project_name = ""
        else:
            project_name = ""
        if _label_group_id and _label_group_id.isdigit():
            hosts = hosts.filter(labels__label_group_id=_label_group_id)
            try:
                label_name = Labels.objects.get(id=int(_label_group_id)).contents
            except:
                label_name = ""            
        else:
            label_name = ""
        
        name = "-".join(filter(None, [project_name, label_name]))

        host_ip_list = "|".join([h.ip for h in hosts])
        res = self.get_data(_type, host_ip_list)
        for item in res:
            result.append({
                "types": name,
                "ip": item['metric']['ip'],
                "idc": item['metric']['idc'],
                "toward": item['metric'].get('toward'),
                "current": item['value'][1]
            })
        return Response(result, status=status.HTTP_200_OK)




class DeviceTopN(APIView):
    """
    此接口按单一服务器设备统计各类资源的使用率TopN, 包括CPU、内存、网络流量、GPU等
    参数：type: 资源类型包括:cpu、mem、net、gpu
    参数：n: 取前N名
    可选参数：project_id: 项目ID
    # 可选参数：label_group_id: 标签组ID
    说明： project_id和label_group_id可同时使用，也可单独使用，不使用则表示查询所有服务器
    例子：/api/monitor/device_topn/?type=cpu&n=10
    例子：/api/monitor/device_topn/?type=mem&n=10&label_group_id=2
    例子：/api/monitor/device_topn/?type=disk&n=10&project_id=1&label_group_id=2
    例子：/api/monitor/device_topn/?type=net&n=10&project_id=1
    例子：/api/monitor/device_topn/?type=gpu&n=10&project_id=1    
    """
    
    permission_classes = (permissions.AllowAny,)
    def get(self, request, *args, **kwargs):
        type = request.query_params.get('type', '')
        if type == '':
            return Response({'error': 'type不能为空'}, status=status.HTTP_400_BAD_REQUEST)
        n = request.query_params.get('n', 10)
        project_id = request.query_params.get('project_id', '')
        label_group_id = request.query_params.get('label_group_id', '')
        
        return Response(monitor_topn(type, n, project_id, label_group_id), status=status.HTTP_200_OK)
   
class BigScreenAssociationScreenViewSet(viewsets.ModelViewSet):
    queryset = BigScreenAssociation.objects.all()
    serializer_class = BigScreenAssociationSerializer
    filterset_fields = ('key',)

# base_auth认证
def base_auth(request):
    token = request.META.get('HTTP_AUTHORIZATION')
    # basic_auth =  base64.b64encode((settings.HTTP_API_MONITOR_USER + ':' + settings.HTTP_API_MONITOR_PWD).encode('utf-8'))
    # 暂时写死
    basic_auth =  base64.b64encode(("prometheus" + ':' + "Ops@2023").encode('utf-8'))
    basic_auth =  'Basic ' + basic_auth.decode('utf-8')
    if token != basic_auth:
        return 1
    return 0
