from django_q.tasks import schedule
from django_q.models import Schedule
from .models import Meeting
from django.utils import timezone
from datetime import timedelta

def delete_old_meetings():
    one_month_ago = timezone.now() - timedelta(days=1)
    Meeting.objects.filter(created_at__lt=one_month_ago).delete()

# Schedule the task
schedule(
    'meetings.tasks.delete_old_meetings',
    schedule_type=Schedule.DAILY
)
