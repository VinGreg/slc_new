from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.models import User
from rest_framework import generics
from django.contrib.auth.decorators import login_required
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth import get_user_model, authenticate, login as auth_login, logout
from django.contrib.auth.backends import ModelBackend
from .models import UserProfile, Meeting
from django.views import View
from django.http import HttpResponseBadRequest, JsonResponse, HttpResponseRedirect
from .serializers import MeetingSerializer
import random, string,json,traceback
from bson import ObjectId
from django.core.exceptions import ValidationError
from django.db.utils import IntegrityError
from django.contrib.sessions.models import Session
from django.contrib.auth.hashers import check_password
from django.contrib import messages
from django.views.decorators.csrf import csrf_exempt
from django.urls import reverse
from chat.models import UserProfile, Meeting
from .forms import MeetingForm
from django.utils import timezone
from datetime import timedelta
import traceback  # Tambahkan untuk menangkap error lebih jelas
from pymongo import MongoClient  # Import MongoDB client

User = get_user_model()  # Use the custom user model

# # Connect to MongoDB
client = MongoClient('mongodb+srv://myAtlasDBUser:Vincent2002@myatlasclusteredu.jzsh9rx.mongodb.net/?retryWrites=true&w=majority&appName=myAtlasClusterEDU')  # Replace with your MongoDB connection string
db = client['ta_slc']  # Replace with your database name
collection = db['chat_customuser']  # Replace with your collection name

# Create your views here.
def main(request):
    return render(request, 'chat/main.html')

# Login view
def login_view(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')

        user = User.objects.filter(username=username).first()

        if user and check_password(password, user.password):
            auth_login(request, user, backend='django.contrib.auth.backends.ModelBackend')

            request.session['user_id'] = str(user._id)  # Simpan _id ke sesi
            request.session["login_method"] = "username_password"  # Tambahkan metode login ke sesi
            request.session.modified = True

            print(f"User ditemukan: {user.username}")
            print(f"Session ID setelah login: {request.session.session_key}")
            return redirect('dashboard')

        print("User tidak ditemukan atau password salah.")
        return render(request, 'chat/login.html', {'error': 'Invalid credentials'})

    return render(request, 'chat/login.html')


@csrf_exempt  
def google_login_callback(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            print("Google Callback Data:", data)

            google_email = data.get("email")

            if not google_email:
                return JsonResponse({"error": "Invalid Google response: missing email"}, status=400)

            # Cek di MongoDB
            user_mongo = collection.find_one({'email': google_email})
            if not user_mongo:
                print(f"Login gagal: email {google_email} belum terdaftar.")
                return JsonResponse({"error": "Email belum terdaftar. Silakan registrasi terlebih dahulu."}, status=401)

            # Cek juga di Django user
            User = get_user_model()
            user_django = User.objects.filter(email=google_email).first()
            if not user_django:
                print(f"Tidak ditemukan user Django untuk email: {google_email}")
                return JsonResponse({"error": "User Django tidak ditemukan."}, status=401)

            # Autentikasi user di Django
            auth_login(request, user_django, backend='django.contrib.auth.backends.ModelBackend')

            # Simpan _id MongoDB ke sesi
            request.session["user_id"] = str(user_mongo['_id'])
            request.session['login_method'] = 'google'
            request.session.modified = True

            print(f"User {google_email} berhasil login dengan Google.")
            return JsonResponse({"message": "Login successful", "user": google_email})

        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON format"}, status=400)
        except Exception as e:
            print("Google Login Error:", str(e))
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request"}, status=400)


# Register view
def register(request):
    if request.method == 'POST':
        username = request.POST['username']
        email = request.POST['email']
        password = request.POST['password']

        if User.objects.filter(username=username).exists():
            messages.error(request, 'Username sudah digunakan')
            return redirect('register')

        if User.objects.filter(email=email).exists():
            messages.error(request, 'Email sudah digunakan')
            return redirect('register')

        user = User(username=username, email=email)
        user.set_password(password)
        user.save()

        messages.success(request, 'Akun berhasil dibuat! Silakan login.')
        return redirect('login')
    return render(request, 'chat/register.html')

def check_username(request):
    username = request.GET.get('username', '')
    exists = User.objects.filter(username=username).exists()
    return JsonResponse({'exists': exists})

def check_email(request):
    email = request.GET.get('email', '')
    exists = User.objects.filter(email=email).exists()
    return JsonResponse({'exists': exists})

# Dashboard view
def dashboard(request):
    print(f"Dashboard: User - {request.user}")
    print(f"Dashboard: Authenticated - {request.user.is_authenticated}")

    if not request.user.is_authenticated:
        print("User tidak terautentikasi, redirect ke login...")
        return redirect('login')

    return render(request, 'chat/dashboard.html')

# New meeting view
@login_required
def new_meet(request):
    meeting_code = None
    if request.method == 'POST':
        form = MeetingForm(request.POST)
        if form.is_valid():
            meeting = form.save(commit=False)
            meeting.created_by = request.user
            meeting_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            meeting.code = meeting_code
            meeting.save()
            
            if form.cleaned_data['schedule_meeting']:
                return redirect('join_meet')
            else:
                return render(request, 'chat/new_meet.html', {'form': form, 'meeting_code': meeting_code, 'meeting_id': meeting.id})
    else:
        form = MeetingForm()
    return render(request, 'chat/new_meet.html', {'form': form, 'meeting_code': meeting_code, 'meeting_id': None})

# Join meeting view
@login_required
def join_meet(request):  
    if request.method == 'POST':
        meeting_code = request.POST.get('meeting_code')
        if not meeting_code:
            return render(request, 'chat/join_meet.html', {'error_message': 'Meeting Code is required'})
        try:
            meeting = Meeting.objects.get(code=meeting_code)
            return redirect('meeting_page', room_name=meeting.id)
        except Meeting.DoesNotExist:
            return render(request, 'chat/join_meet.html', {'error_message': 'Meeting not found'})
        
    # Filter waktu
    now = timezone.now()
    meetings = Meeting.objects.filter(
        created_by=request.user,
        start_time__gte=now - timedelta(days=1)  # Ambil meeting sejak 1 hari yang lalu hingga ke depan
    ).order_by('start_time')
    return render(request, 'chat/join_meet.html', {'meetings': meetings})

# Delete meeting view
@login_required
def delete_meeting(request, meeting_id):
    meeting = get_object_or_404(Meeting, id=meeting_id, created_by=request.user)
    if request.method == 'POST':
        meeting.delete()
        return redirect('join_meet')
    return render(request, 'chat/delete_meeting.html', {'meeting': meeting})

# Meeting page view
def meeting_page(request, room_name):
    if not room_name or not ObjectId.is_valid(room_name):
        return HttpResponseBadRequest("Invalid meeting ID")
    try:
        meeting = Meeting.objects.get(id=room_name)
        participants = User.objects.filter(meeting=meeting)  # Assuming a relationship exists
        return render(request, 'chat/meeting_page.html', {'meeting': meeting, 'participants': participants})
    except Meeting.DoesNotExist:
        return render(request, 'chat/meeting_page.html', {'error': 'Meeting not found'})

# Personal info view
@login_required
def personal_info(request):
    # Ambil atau buat UserProfile jika belum ada
    user_profile, created = UserProfile.objects.get_or_create(user=request.user)

    return render(request, 'chat/personal_info.html', {'user_profile': user_profile})

# Edit personal info view
@login_required
def edit_personal_info(request):
    user_profile = UserProfile.objects.filter(user=request.user).first()

    if request.method == "POST":
        user_profile.nama_lengkap = request.POST.get("nama_lengkap")
        user_profile.email = request.POST.get("email")
        user_profile.nomor_ponsel = request.POST.get("nomor_ponsel")

        # Cek apakah ada file foto yang diunggah
        if 'foto' in request.FILES:
            user_profile.foto = request.FILES['foto']  # ✅ Simpan file yang diunggah

        user_profile.save()
        return redirect('personal_info')

    return render(request, 'chat/edit_personal_info.html', {'user_profile': user_profile})

def logout_view(request):
    if request.method == "POST":
        logout(request)  # Logout dari Django
        return JsonResponse({"status": "success", "message": "Logged out successfully"})
    
    return JsonResponse({"status": "error", "message": "Invalid request"}, status=400)


def lupa_password(request):
    return render(request, 'chat/lupa_pwd.html')

def validate_user_info(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        email = request.POST.get('email')
        phone = request.POST.get('phone')
        user = User.objects.filter(username=username, email=email, userprofile__nomor_ponsel=phone).first()
        if user:
            request.session['email'] = email
            return JsonResponse({'success': True})
        return JsonResponse({'success': False, 'error': 'Informasi tidak valid'})
    return JsonResponse({'success': False, 'error': 'Invalid request'})

def reset_password(request):
    if request.method == 'POST':
        email = request.session.get('email')
        user = User.objects.filter(email=email).first()
        if user:
            new_password = request.POST.get('new_password')
            user.set_password(new_password)
            user.save()
            return redirect('login')
    return render(request, 'chat/reset_password.html')


class MeetingCreateView(generics.CreateAPIView):
    queryset = Meeting.objects.all()
    serializer_class = MeetingSerializer

class MeetingDetailView(generics.RetrieveAPIView):
    queryset = Meeting.objects.all()
    serializer_class = MeetingSerializer
    lookup_field = 'meeting_id'
