var dicOption = {
  line: [{ label: '线条', value: 'line' }, { label: '圆环', value: 'circle' }],
  lineStyle: [{ label: '实线', value: 'solid' }, { label: '虚线', value: 'dashed' }, { label: '点线', value: 'dotted' }],
  fontWeight: [{ label: 'normal', value: 'normal' }, { label: 'bold', value: 'bold' }, { label: 'bolder', value: 'bolder' }, { label: 'ligter', value: 'ligter' }],
  border: [{ label: '无边框', value: '' }, { label: '内置图片', value: 'img' }, { label: '内置边框', value: 'border' }],
  textAlign: [{ label: '居中', value: 'center' }, { label: '左对齐', value: 'left' }, { label: '右对齐', value: 'right' }],
  verticalAlign: [{ label: '居中', value: 'center' }, { label: '顶部对齐', value: 'top' }, { label: '底部对齐', value: 'bottom' }],
  dataType: [{ label: '静态数据', value: 0 }, { label: '动态数据', value: 1 }],
  orientList: [{ label: '竖排', value: 'vertical' }, { label: '横排', value: 'horizontal' }],
  dataMethod: [{ label: 'POST', value: 'post' }, { label: 'GET', value: 'get' }],
  eventList: ['tabs'],
  foldList: ['fold'],
  statictabsList: ['statictabs'],
  dataList: ['tabs', 'map', 'video', 'wordCloud', 'pie', 'pictorialBar', 'iframe', 'swiper', 'flop', 'bar', 'line', 'progress', 'table', 'gauge', 'funnel', 'scatter', 'radar', 'topo', 'piepro', 'gaugepro', 'text', 'alarm'],
  themeList: [{
    label: '默认配色',
    value: 'avue'
  }, {
    label: '紫色主题',
    value: 'macarons'
  }, {
    label: '绿色主题',
    value: 'wonderland'
  }],
  layoutList: [{
    label: 'None',
    value: 'none'
  }, {
    label: '力引导布局',
    value: 'force'
  }, {
    label: '环形布局',
    value: 'circular'
  }],
  barList: ['bar', 'line'],
  titleList: ['bar', 'pie', 'line', 'radar', 'funnel', 'piepro', 'gaugepro', 'fold'],
  labelList: ['bar', 'line', 'pie', 'radar', 'scatter'],
  legendList: ['bar', 'pie', 'line', 'radar', 'funnel'],
  colorList: ['bar', 'pie', 'line', 'gauge', 'funnel', 'scatter', 'radar', 'piepro', 'gaugepro', 'text'],
  tipList: ['bar', 'pie', 'line', 'gauge', 'funnel', 'scatter', 'radar', 'topo'],
  postionList: ['bar', 'line', 'pictorialbar'],
  formatterList: ['bar', 'map', 'line', 'pie', 'gauge', 'funnel', 'scatter', 'radar', 'topo', 'text'],
  clickFormatterList: ['map'],
  labelFormatterList: ['bar'],
  legendTypeList: [{
    label: '普通图例',
    value: 'plain',
  }, {
    label: '可滚动图例',
    value: 'scroll',
  }],
  tabsTypeList: [{
    label: '选项卡',
    value: 'tabs',
  }, {
    label: '选择框',
    value: 'select',
  }],
  paramTypeList: [{
    label: '更新数据',
    value: 'updateUrl',
  }, {
    label: '更新配置',
    value: 'updateOption',
  }],
  mapList: [{
    label: '中国',
    value: 0,
    list: map_china
  }, {
    label: '广西',
    value: 1,
    list: map_guangxi
  }, {
    label: '南宁',
    value: 2,
    list: map_nanning
  }],
  mapType: [{
    label: '原生',
    value: 0
  }],
  target: [{ label: '本窗口', value: '_self' }, { label: '新窗口', value: '_blank', }],
  swiperType: [{ label: '普通', value: '' }, { label: '立体', value: 'card' }],
  swiperIndicator: [{ label: '外部', value: 'indicator' }, { label: '不显示', value: 'none' }],
  legendIcon: [{ label: '空心圆', value: 'emptyCircle' }, { label: '实心圆', value: 'circle' }, { label: '矩形', value: 'rect' }, { label: '圆角矩形', value: 'roundRect' }, { label: '三角形', value: 'triangle' }, { label: '钻石', value: 'diamond' }, { label: 'PIN', value: 'pin' }, { label: '箭头', value: 'arrow' }, { label: '无', value: 'none' }],
  format: [{ label: '日期', value: 'yyyy-MM-dd' }, { label: '日期+时分', value: 'yyyy-MM-dd hh:mm' }, { label: '日期+时分秒', value: 'yyyy-MM-dd hh:mm:ss' }, { label: '日期(无年)', value: 'MM-dd' }, { label: '时分', value: 'hh:mm' }, { label: '时分秒', value: 'hh:mm:ss' }, { label: '星期', value: 'day' }]
}