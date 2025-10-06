#! /usr/bin/env python
# -*- coding: utf-8 -*-

from __future__ import unicode_literals
from rest_framework import serializers
from monitor.models import *
import datetime, re
from django.conf import settings


class CustomBigScreenSerializer(serializers.ModelSerializer):

    class Meta:
        model = CustomBigScreen
        fields = "__all__"


class CustomBigScreenBusComSerializer(serializers.ModelSerializer):

    class Meta:
        model = CustomBigScreenBusCom
        fields = "__all__"


class CustomBigScreenListSerializer(serializers.ModelSerializer):

    class Meta:
        model = CustomBigScreen
        fields = ("id", "name", "ispublished", "thumbnail")


class BigScreenAssociationSerializer(serializers.ModelSerializer):

    class Meta:
        model = BigScreenAssociation
        fields = "__all__"







