from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AbstractUser
from datetime import timedelta
from django.utils import timezone
from bson import ObjectId
import uuid

# Create your models here.

def generate_object_id():
    return str(uuid.uuid4())

def generate_objectid_string():
    return str(ObjectId())

class CustomUser(AbstractUser):
    _id = models.CharField(max_length=255, primary_key=True, default=generate_object_id, editable=False)  # Pakai UUID agar string
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(unique=True)
    user_fullname = models.CharField(max_length=100)
    user_number = models.CharField(max_length=20, blank=True, null=True)
    user_photo = models.ImageField(upload_to='photos/', blank=True, null=True)

    def save(self, *args, **kwargs):
        if 'update_fields' in kwargs and 'last_login' in kwargs['update_fields']:
            kwargs['update_fields'].remove('last_login')
        super().save(*args, **kwargs)

class Meeting(models.Model):
    id = models.CharField(
        primary_key=True,
        max_length=24,
        default=generate_objectid_string,  # Use the named function here
        editable=False
    )  # Supports ObjectId as string
    title = models.CharField(max_length=100)
    description = models.TextField()
    start_time = models.DateTimeField()
    created_by = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    participants = models.ManyToManyField(CustomUser, related_name= 'meetings')  # Link to User model
    created_at = models.DateTimeField(auto_now_add=True)
    code = models.CharField(max_length=6)

    def is_expired(self):
        return timezone.now() > self.created_at + timedelta(days=30)
    
    def __str__(self):
        return self.title  # Display title when object is 
    
<<<<<<< HEAD
=======
    
>>>>>>> ccf8934 (Pesan commit kamu)
class UserProfile(models.Model):
    user = models.OneToOneField(
        CustomUser, on_delete=models.CASCADE, to_field="_id", db_column="user_id", primary_key=True, default=""
    )
    nama_lengkap = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    nomor_ponsel = models.CharField(max_length=20, blank=True, null=True)
    foto = models.ImageField(upload_to='uploads/', default='profile_pics/default.jpg')

    def __str__(self):
        return self.nama_lengkap  # Display nama_lengkap when object is called
    
    
User = get_user_model()
