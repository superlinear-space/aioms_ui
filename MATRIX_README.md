# CheckRequest Matrix 使用说明

## 概述

这是一个基于YAML配置的CheckRequest矩阵显示系统，支持Prometheus风格的数据格式。每个domain可以有不同数量的instances，每个instance可以有不同数量的check_functions。

## 功能特性

- ✅ **不规则矩阵**：支持每个domain有不同数量的instances和check_functions
- ✅ **YAML配置**：通过YAML文件配置数据，无需修改代码
- ✅ **状态颜色**：绿色(健康)、黄色(警告)、红色(严重)、灰色(未知)
- ✅ **过滤搜索**：支持按domain、instance、check_function过滤
- ✅ **实时刷新**：支持刷新数据
- ✅ **统计面板**：显示各状态的数量统计

## 使用方法

### 1. 配置数据

编辑 `/public/check_requests.yaml` 文件，按照以下格式添加您的数据：

```yaml
check_requests:
  - domain: "web_servers"
    instance: "web1"
    check_function: "http_response_time"
    value: 0  # 0=健康, 1=失败, 2=未知
    timestamp: 1703123456789
  
  - domain: "web_servers"
    instance: "web1"
    check_function: "cpu_usage"
    value: 1
    timestamp: 1703123456789
  
  # 更多数据...
```

### 2. 数据格式说明

- **domain**: 域名，字符串类型
- **instance**: 实例名，字符串类型
- **check_function**: 检查函数名，字符串类型
- **value**: 状态值，数字类型
  - `0`: 健康 (绿色)
  - `1`: 警告 (黄色)
  - `2`: 严重 (红色)
  - `3`: 未知 (灰色)
- **timestamp**: 时间戳，数字类型（可选，默认为当前时间）

### 3. 访问界面

1. 启动应用：`npm run dev`
2. 打开浏览器访问：`http://localhost:5173`
3. 登录后点击左侧菜单的 "Menu 3"
4. 查看矩阵显示

### 4. 界面功能

- **统计面板**：显示总数、健康、警告、严重、未知的数量
- **过滤功能**：
  - 按domain过滤
  - 搜索instance
  - 搜索check_function
- **刷新按钮**：重新加载YAML数据
- **状态图例**：显示各状态的颜色含义

## 示例数据

参考 `/public/check_requests_example.yaml` 文件，其中包含：
- 4个不同的domains
- 每个domain有不同数量的instances
- 每个instance有不同数量的check_functions
- 各种状态值的示例

## 矩阵显示规则

1. **行**：每个domain一行
2. **列**：所有唯一的instances作为列
3. **单元格**：显示该domain-instance组合的所有check_functions
4. **空缺**：如果某个domain没有某个instance，显示为 "-"
5. **排序**：instances和check_functions按字母顺序排序

## 错误处理

- 如果YAML文件格式错误，会显示错误信息
- 如果数据为空，会提示检查配置文件
- 支持数据验证，确保value在0-3范围内

## 技术实现

- **前端**：React + TypeScript + Ant Design
- **数据解析**：js-yaml库解析YAML文件
- **缓存**：30秒数据缓存，提高性能
- **响应式**：支持水平滚动查看所有数据

## 自定义配置

您可以根据需要修改以下内容：
- 状态颜色：修改 `src/data/mockData.ts` 中的 `STATUS_MAP`
- 缓存时间：修改 `src/services/checkRequestService.ts` 中的 `CACHE_DURATION`
- 界面样式：修改 `src/components/CheckRequestMatrix.tsx` 中的样式
