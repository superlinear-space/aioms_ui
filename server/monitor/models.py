# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models

# Create your models here.

# 自定义大屏相关配置表
class CustomBigScreen(models.Model):
    name = models.CharField(u"大屏名称", max_length=50, null=True, blank=True)
    ispublished = models.BooleanField(u"是否发布")
    config = models.TextField(u"配置内容", null=True, blank=True)
    lists = models.TextField(u"模板参数内容", null=True, blank=True)
    thumbnail = models.TextField(u"缩略图", null=True, blank=True)
    modified_time = models.DateTimeField(verbose_name=u"更新时间", blank=True, null=True, auto_now=True)
    modifier = models.CharField(u"修改人", max_length=20, null=True, blank=True)
    creator = models.CharField(u"创建人", max_length=20, null=True, blank=True)
    creat_time = models.DateTimeField(verbose_name=u"创建时间", blank=True, null=True, auto_now_add=True)

    class Meta:
        db_table = 'monitor_custom_bigscreen'
        verbose_name = u'自定义大屏'
        verbose_name_plural = verbose_name

# 自定义大屏业务组件表
class CustomBigScreenBusCom(models.Model):
    name = models.CharField(u"业务组件名称", max_length=255, null=True, blank=True)
    title = models.CharField(u"标题", max_length=255, null=True, blank=True)
    child = models.TextField(u"子级内容", null=True, blank=True)
    component = models.TextField(u"组件内容", null=True, blank=True)
    thumbnail = models.TextField(u"缩略图", null=True, blank=True)
    dataFormatter = models.TextField(u"数据格式化函数", null=True, blank=True)
    formatter = models.TextField(u"格式化函数", null=True, blank=True)
    dataMethod = models.CharField(u"请求方法", max_length=50, null=True, blank=True)
    url = models.CharField(u"URL", max_length=2048, null=True, blank=True)
    time = models.IntegerField(verbose_name=u"刷新时间", blank=True, null=True, help_text="左边距")
    data = models.TextField(u"数据", null=True, blank=True)
    helpText = models.CharField(u"提示文本", max_length=255, null=True, blank=True)
    icon = models.CharField(u"图标类名", max_length=255, null=True, blank=True)
    index = models.IntegerField(verbose_name=u"组件顺序", blank=True, null=True, help_text="组件顺序")
    zIndex = models.IntegerField(verbose_name=u"样式层级", blank=True, null=True, help_text="样式层级")
    dataType = models.IntegerField(verbose_name=u"数据类型", blank=True, null=True, help_text="数据类型")
    modified_time = models.DateTimeField(verbose_name=u"更新时间", blank=True, null=True, auto_now=True)
    modifier = models.CharField(u"修改人", max_length=20, null=True, blank=True)
    creator = models.CharField(u"创建人", max_length=20, null=True, blank=True)
    creat_time = models.DateTimeField(verbose_name=u"创建时间", blank=True, null=True, auto_now_add=True)

    class Meta:
        db_table = 'monitor_custom_bigscreen_bus_com'
        verbose_name = u'业务组件'
        verbose_name_plural = verbose_name


# 大屏关联配置表
# 与项目、主机ip等建立关联关系
class BigScreenAssociation(models.Model):
    key = models.CharField(u"关联key", max_length=50, null=False, blank=False, help_text="大屏与对应实体关联的唯一标识")
    name = models.CharField(u"关联名称", max_length=256, null=True, blank=True)
    bigscreen_url = models.CharField(u"对应大屏地址", max_length=256, null=True, blank=True)
    param = models.CharField(u"参数", max_length=100, blank=True, null=True)

