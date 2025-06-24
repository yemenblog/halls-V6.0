### 1. إعداد بيئة السيرفر

يمكنك استخدام **Django** كإطار عمل لبناء السيرفر. إليك كيفية إعداد مشروع Django:

#### 1.1. تثبيت Django

```bash
pip install django
```

#### 1.2. إنشاء مشروع Django

```bash
django-admin startproject halls_project
cd halls_project
```

#### 1.3. إنشاء تطبيق جديد

```bash
python manage.py startapp halls
```

### 2. إعداد قاعدة البيانات

يمكنك استخدام **SQLite** (الافتراضي) أو **PostgreSQL** أو **MySQL**. إليك كيفية إعداد قاعدة بيانات باستخدام SQLite:

#### 2.1. تعديل إعدادات قاعدة البيانات في `settings.py`

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / "db.sqlite3",
    }
}
```

#### 2.2. إنشاء نماذج البيانات

في ملف `models.py` داخل تطبيق `halls`، يمكنك إنشاء نماذج للحسابات، الحجوزات، والطلبات:

```python
from django.db import models

class User(models.Model):
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=255)
    name = models.CharField(max_length=255)

class Hall(models.Model):
    name = models.CharField(max_length=255)
    location = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    capacity = models.IntegerField()

class Booking(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    hall = models.ForeignKey(Hall, on_delete=models.CASCADE)
    date = models.DateField()
    time = models.TimeField()
    guests_count = models.IntegerField()
    notes = models.TextField(blank=True)
```

#### 2.3. إنشاء قاعدة البيانات

```bash
python manage.py makemigrations
python manage.py migrate
```

### 3. إعداد واجهة برمجة التطبيقات (API)

يمكنك استخدام **Django REST Framework** لإنشاء API:

#### 3.1. تثبيت Django REST Framework

```bash
pip install djangorestframework
```

#### 3.2. إضافة `rest_framework` إلى `INSTALLED_APPS` في `settings.py`

```python
INSTALLED_APPS = [
    ...
    'rest_framework',
    'halls',
]
```

#### 3.3. إنشاء Serializers

في ملف `serializers.py` داخل تطبيق `halls`:

```python
from rest_framework import serializers
from .models import User, Hall, Booking

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'

class HallSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hall
        fields = '__all__'

class BookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = '__all__'
```

#### 3.4. إنشاء Views

في ملف `views.py` داخل تطبيق `halls`:

```python
from rest_framework import viewsets
from .models import User, Hall, Booking
from .serializers import UserSerializer, HallSerializer, BookingSerializer

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

class HallViewSet(viewsets.ModelViewSet):
    queryset = Hall.objects.all()
    serializer_class = HallSerializer

class BookingViewSet(viewsets.ModelViewSet):
    queryset = Booking.objects.all()
    serializer_class = BookingSerializer
```

#### 3.5. إعداد URLs

في ملف `urls.py` داخل تطبيق `halls`:

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, HallViewSet, BookingViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'halls', HallViewSet)
router.register(r'bookings', BookingViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
```

ثم أضف هذا إلى `urls.py` الرئيسي في مشروعك:

```python
from django.urls import path, include

urlpatterns = [
    path('api/', include('halls.urls')),
]
```

### 4. إرسال الطلبات من الواجهة الأمامية

يمكنك استخدام **Fetch API** أو **Axios** لإرسال الطلبات إلى السيرفر. على سبيل المثال، لإرسال طلب تسجيل الدخول:

```javascript
fetch('http://localhost:8000/api/users/', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value,
    }),
})
.then(response => response.json())
.then(data => {
    console.log('Success:', data);
})
.catch((error) => {
    console.error('Error:', error);
});
```

### 5. تشغيل السيرفر

يمكنك تشغيل السيرفر باستخدام الأمر:

```bash
python manage.py runserver
```

### 6. اختبار التطبيق

يمكنك الآن اختبار التطبيق من خلال الواجهة الأمامية والتأكد من أن كل شيء يعمل بشكل صحيح.

### ملاحظات

- تأكد من إضافة التحقق من صحة البيانات وإدارة الأخطاء في واجهة برمجة التطبيقات.
- يمكنك استخدام JWT أو OAuth لتأمين واجهة برمجة التطبيقات.
- يمكنك استخدام أدوات مثل Postman لاختبار واجهة برمجة التطبيقات الخاصة بك.

بهذه الطريقة، يمكنك ربط كل شيء بسيرفر وإرسال الطلبات إلى صفحة الإدارة، بالإضافة إلى إعداد قاعدة بيانات للحسابات والربط بين كل شيء.