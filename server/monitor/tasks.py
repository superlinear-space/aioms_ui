import yaml, json

# 生成对应yaml或者json文件,并返回所生成文件名路径列表
def file_creater(datas, source_file_path, file_with_path_and_name, file_type):
    """
    datas: dict, 需要转换数据字典
    source_file_path: string, 临时存放数据目录
    file_with_path_and_name: dict,信息字典
    file_type: yml or json
    """
    result_file_paths = []
    # 循环每个数据的数据名
    for dataname in datas.keys():
        # 获取需要转换的数据
        data = datas[dataname]
        # 构造生成文件的绝对路径文件名
        tmpfilename = source_file_path + file_with_path_and_name[dataname]['filename']

        result_file_paths.append(tmpfilename)

        # 根据type写文件
        with open(tmpfilename, 'w', encoding='utf-8') as s:
            if file_type == 'json':
                s.write(json.dumps(data, indent=4, ensure_ascii=False))
            elif file_type == 'yml':
                yaml.safe_dump(data, stream=s, default_flow_style=False, encoding='utf-8', allow_unicode=True)
            else:
                return 'file type not json or yml'

    return result_file_paths

def caculate_cpu_usage(data):
    pre,cur,_ = data.split("\r\n")
    per_total = 0
    cur_total = 0
    pre_idle = 0
    cur_idle = 0
    for index, item in enumerate(pre.split(" ")):
        num = int(item)
        if index == 3:
            pre_idle = num
        per_total +=num
    for index, item in enumerate(cur.split(" ")):
        num = int(item)
        if index == 3:
            cur_idle = num
        cur_total +=num   
    return round(100 - ( cur_idle - pre_idle) / (cur_total - per_total) * 100, 2)
def caculate_memory(data):
    try:
        total, available, _ = data.split("\r\n")
        total = int(total)
        available = int(available)
        return round(( total - available ) / total * 100, 2)
    except Exception:
        return 0
    
    
