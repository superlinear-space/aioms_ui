from monitor.models import  MonitorServiceConfig
import yaml
from collections import OrderedDict
import copy


class SqlToJsonDataFrame(object):
    """
    解析数据库中的数据，进行数据格式化，生成json串
    # TODO 完善异常处理，使配置文件生成过程中，可以定位到出现异常的具体配置
    """
    def __init__(self):
        self.iterator = {
            "Dict": self.SqlToDictIterator,
            "List": self.SqlToListIterator
        }
    
    def _init_tree(self, filter_param={}):
        data_list =  list(MonitorServiceConfig.objects.filter(**filter_param).values("id", "parent_id", "value_type", "key", "value", "order"))
        self.tree = self.generate_tree(data_list)

    @property     
    def config_tree(self):
        return self.tree
    
    def get_config_yml(self):
        config_dict = self.translate(self.tree)
        if config_dict:
            return self.ordered_yaml_dump(config_dict, encoding='utf-8')
        else:
            return False
    
    def get_config_dict(self):
        return self.translate(self.tree)
    
    def __dispose_value(self, value_type, value):
        if value_type == "Num":
            try:
                return int(value)
            except Exception as e:
                print("int数据有误")
        
        if value_type == "Bool":
            try:
                return bool(value)
            except Exception as e:
                print("bool数据有误")
        else:
            return value
    
    def generate_tree(self, data, key_column='id', parent_column='parent_id', child_column='children'):
        data_dic = {}
        for d in data:
            data_dic[d.get(key_column)] = d # 将列表数据转为哈希结构数据，便于取值

        data_tree_list = []

        # 遍历哈希字典
        for d_id, d_dic in data_dic.items():
            pid = d_dic.get(parent_column)
            
            # 父id等于0或为空，将其加入root节点
            if not pid: 
                data_tree_list.append(d_dic)
            else:
                # 将当前数据加入到所属的父节点的　children　中
                try:
                    data_dic[pid][child_column].append(d_dic)
                except KeyError:
                    data_dic[pid][child_column] = []
                    data_dic[pid][child_column].append(d_dic)
        return data_tree_list

    def SqlToDictIterator(self, data_list):
        __result = OrderedDict({})
        if not data_list:
            return __result
        data_list.sort(key=lambda x: x.get("order"), reverse=False)
        for item in data_list:
            child = item.get("children")
            value_type = item.get("value_type")
            if value_type in ["Dict", "List"]:
                if not item.get("key") and value_type == "List":
                    __result = self.iterator[value_type](child)
                else:
                    __result[item["key"]] = self.iterator[value_type](child)
            else:
                # 适配key是int的情况
                if item["key"].isdigit():
                    __result[int(item["key"])] = self.__dispose_value(value_type, item.get("value"))
                else:
                    __result[item["key"]] = self.__dispose_value(value_type, item.get("value"))

        return __result
    
    def SqlToListIterator(self, data_list):
        __result = []
        if not data_list:
            return __result
        # 列表按照order值排序
        data_list.sort(key=lambda x: x.get("order"), reverse=False)
        for item in data_list:
            child = item.get("children")
            value_type = item.get("value_type")

            # 当value_type 为Dict、List时, 递归取值
            tmp_value = self.iterator[value_type](child) if value_type in ["Dict", "List"] else self.__dispose_value(value_type, item.get("value"))
            if item.get("key"):
                __result.append({item["key"]: tmp_value})
            else:
                __result.append(tmp_value)

        return __result

    def translate(self, tree):
        try:
            result = self.SqlToDictIterator(tree)
            return result
        except Exception as e:
            print("生成配置文件出错", str(e))
            return False
    
    # python-dict转换为为yaml
    def ordered_yaml_dump(self, data, stream=None, Dumper=yaml.SafeDumper, **kwargs):
        class OrderedDumper(Dumper):
            pass

        def _dict_representer(dumper, data):
            return dumper.represent_mapping(
                yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,
                data.items())

        OrderedDumper.add_representer(OrderedDict, _dict_representer)
        return yaml.dump(data, stream, OrderedDumper, **kwargs)


class ModuldConfigDataFrame(SqlToJsonDataFrame):
    def __init__(self, root_config_id):
        super().__init__()
        self.root_id = root_config_id
        self._tree = []

    def _init_module_tree(self):
        data_list = list(MonitorServiceConfig.objects.filter(id=self.root_id).values("id", "parent_id", "value_type", "key", "value", "order"))
        tree = self.generate_module_tree(data_list)
        module_dict = self.translate(tree)
        # pms配置的所有job的root节点本身就是一个Dict，因此需要先去掉最外层的`{}`
        try:
            return module_dict['']
        except KeyError:
            return module_dict



    
    def _get_query(self, parent_id):
        return list(MonitorServiceConfig.objects.filter(parent_id=parent_id).values("id", "parent_id", "value_type", "key", "value", "order"))
    
    def generate_module_tree(self, data_list):
        tree = []
        for item in data_list:
            if item["value_type"] in ["Dict", "List"]:
                item["children"] = self._get_query(item["id"])
            else:
                item["children"] = []
            tree.append(item)
            self.generate_module_tree(item["children"])
        return tree


class DictToSql(object):
    """
    解析字典中数据，进行数据反格式化，录入数据库表中
    """
    def __init__(self, data, component_id, ignore=[]):
        self.data = data
        self.ignore = ignore
        self.component_id = component_id
    def translate(self, parent_id=None):
        result_ids = []
        for index, item in enumerate(self.data.keys()):
            result_id = self.handleData(parent_id, item, self.data[item], index)
            result_ids.append(copy.copy(result_id))
        return result_ids
    def handleData(self, parent_id, key, data, order=0):

        if isinstance(data, str):
            id =self.createrecord(parent_id, 'Str', key, data, 0)
            return id


        if isinstance(data, bool):
            if data:
                id = self.createrecord(parent_id, 'Bool', key, 'True', 0)
            else:
                id = self.createrecord(parent_id, 'Bool', key, "", 0)
            return id
        
        if isinstance(data, int):
            id = self.createrecord(parent_id, 'Num', key, data, 0)
            return id

        if isinstance(data, dict):
            id = self.createrecord(parent_id, 'Dict', key, {}, order)
            for index, item in enumerate(data.keys()):
                self.handleData(id, item, data[item], order=index)
            return id

        if isinstance(data, list):
            id = self.createrecord(parent_id, 'List', key, {}, order)
            for index, item in enumerate(data):
                self.handleData(id, '', item, order=index)
            return id
    # 删除配置方法
    def delete_chilren(self, id):
        children = MonitorServiceConfig.objects.filter(parent_id=id)
        # 如果拟删除元素有child,先递归删除child
        if children.exists():
            for child in children:
                self.delete_chilren(child.id)
        # 删完child再删自己
        self.deleterecord(id)

    # 如果输入库有修改，重写此方法
    def createrecord(self, parent_id, types, key, value, order=0):
        input_data = {
        }
        input_data['monitor_service_id'] = self.component_id
        input_data['parent_id'] = parent_id
        if types:
            input_data['value_type'] = types
        input_data['key'] = key
        input_data['value'] = value
        input_data['order'] = order
        instance = MonitorServiceConfig.objects.create(**input_data)
         
        return instance.id
    # 如果删除库有修改，重写此方法
    def deleterecord(self, id):
        MonitorServiceConfig.objects.filter(id=id).delete()