from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AbstractUser
from datetime import timedelta
from django.utils import timezone
from bson import ObjectId
from pymongo import MongoClient
from django.conf import settings
from gridfs import GridFS
import uuid
import base64

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
    user_photo = models.CharField(max_length=255, blank=True, null=True)  # Simpan ID file dari MongoDB

    def save_user_photo_to_mongo(self, photo_file):
        """Simpan foto ke MongoDB dan simpan ID-nya."""
        client = MongoClient(settings.MONGO_URI)
        db = client[settings.MONGO_DB_NAME]
        fs = GridFS(db)
        file_id = fs.put(photo_file, filename=f"{self.username}_photo")
        client.close()
        return str(file_id)

    def save(self, *args, **kwargs):
        if 'user_photo' in kwargs:
            photo_file = kwargs.pop('user_photo')
            self.user_photo = self.save_user_photo_to_mongo(photo_file)
        super().save(*args, **kwargs)
    def get_user_photo_from_mongo(self):
        """Ambil foto dari MongoDB berdasarkan ID."""
        if not self.user_photo:
            return None
        client = MongoClient(settings.MONGO_URI)
        db = client[settings.MONGO_DB_NAME]
        fs = GridFS(db)
        file = fs.get(ObjectId(self.user_photo))
        client.close()
        return base64.b64encode(file.read()).decode('utf-8')  # Kembalikan konten file

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
    
class UserProfile(models.Model):
    user = models.OneToOneField(
        CustomUser, on_delete=models.CASCADE, to_field="_id", db_column="user_id", primary_key=True, default=""
    )
    nama_lengkap = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    nomor_ponsel = models.CharField(max_length=20, blank=True, null=True)
    foto = models.ImageField(max_length=255, blank=True, null=True, default='profile_pics/default.jpg')

    def __str__(self):
        return self.nama_lengkap  # Display nama_lengkap when object is called
    
    
User = get_user_model()
