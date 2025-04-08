from django import forms
from .models import Meeting
from django.utils import timezone

class MeetingForm(forms.ModelForm):
    schedule_meeting = forms.BooleanField(required=False, label='Schedule for later')

    class Meta:
        model = Meeting
        fields = ['title', 'description', 'start_time']
        widgets = {
            'start_time': forms.DateTimeInput(attrs={'type': 'datetime-local'}),
        }

    #menangani error jika start_time masa lalu
    def clean_start_time(self):
        start_time = self.cleaned_data.get('start_time')
        if start_time and start_time < timezone.now():
            raise forms.ValidationError("Start time cannot be in the past")
        return start_time
