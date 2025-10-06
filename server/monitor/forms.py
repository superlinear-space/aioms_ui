#! /usr/bin/env python
# -*- coding: utf-8 -*-

from django import forms
from django.forms.widgets import *
from .models import Alerts, Dashboard


class Alerts_Form(forms.ModelForm):

    class Meta:
        model = Alerts
        exclude = ("id",)
        widgets = {
            'status': Select(attrs={'class': 'form-control'}),
            'alertlevel': Select(attrs={'class': 'form-control'}),
        }
