// المتغيرات العامة
let currentUser = JSON.parse(localStorage.getItem('user')) || null;
let allListings = [];
let map = null;

// التهيئة عند التشغيل
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.getElementById('splash-screen').style.display = 'none';
        if (currentUser) {
            initApp();
        } else {
            document.getElementById('auth-screen').style.display = 'flex';
            loadGovernorates();
        }
    }, 2000);
});

// --- دوال المصادقة ---
function showAuthTab(tab) {
    document.querySelectorAll('.tabs-auth .tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    
    // تفعيل التبويب المختار
    event.target.classList.add('active');
    document.getElementById(`${tab}-form`).classList.add('active');
}

async function loadGovernorates() {
    const res = await fetch('/api/governorates');
    const govs = await res.json();
    const select = document.getElementById('reg-gov');
    select.innerHTML = '<option value="">اختر المحافظة</option>';
    govs.forEach(g => {
        select.innerHTML += `<option value="${g.id}">${g.name}</option>`;
    });
}

async function loadCities(govId) {
    const res = await fetch(`/api/cities/${govId}`);
    const cities = await res.json();
    const select = document.getElementById('reg-city');
    select.innerHTML = '<option value="">اختر المنطقة</option>';
    cities.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
}

// تسجيل الدخول
document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const phone = document.getElementById('login-phone').value;
    const password = document.getElementById('login-password').value;
    
    const res = await fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({phone, password})
    });
    const data = await res.json();
    if(data.success) {
        localStorage.setItem('user', JSON.stringify(data.user));
        currentUser = data.user;
        document.getElementById('auth-screen').style.display = 'none';
        initApp();
    } else {
        alert(data.error);
    }
};

// تسجيل جديد
document.getElementById('register-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
        name: document.getElementById('reg-name').value,
        phone: document.getElementById('reg-phone').value,
        password: document.getElementById('reg-pass').value,
        governorate_id: document.getElementById('reg-gov').value,
        city_id: document.getElementById('reg-city').value
    };
    
    const res = await fetch('/api/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    });
    const resp = await res.json();
    if(resp.success) {
        alert('تم التسجيل بنجاح! تم إضافة 5000 رصيد افتتاحي.');
        // تحويل للدخول تلقائياً
        localStorage.setItem('user', JSON.stringify(resp.user));
        currentUser = resp.user;
        document.getElementById('auth-screen').style.display = 'none';
        initApp();
    } else {
        alert(resp.error);
    }
};

// --- منطق التطبيق الرئيسي ---
function initApp() {
    document.getElementById('home-screen').style.display = 'flex';
    document.getElementById('header-username').innerText = currentUser.name;
    loadAds();
    loadListings('all');
}

// تحميل الإعلانات
async function loadAds() {
    // محاكاة بيانات
    const adsContainer = document.getElementById('ads-slider');
    // في الواقع ستجلبها من الـ API
    // const res = await fetch('/api/ads'); ...
    const ads = [
        {image: 'https://placehold.co/600x300/1976d2/FFF?text=Wedding+Offer', title: 'عرض الموسم'},
        {image: 'https://placehold.co/600x300/purple/FFF?text=New+Cars', title: 'سيارات حديثة'}
    ];
    adsContainer.innerHTML = '';
    ads.forEach(ad => {
        adsContainer.innerHTML += `
            <div class="ad-card" style="background-image: url('${ad.image}')">
                <div class="ad-overlay"><h3>${ad.title}</h3></div>
            </div>
        `;
    });
}

// تحميل القوائم (قاعات/سيارات/شاليهات)
async function loadListings(type) {
    const container = document.getElementById('listings-container');
    container.innerHTML = '<div style="text-align:center; padding:20px;">جاري التحميل...</div>';
    
    // Gov ID للفلترة حسب محافظة المستخدم
    const res = await fetch(`/api/listings?type=${type}&gov_id=${currentUser.governorate_id || ''}`);
    allListings = await res.json();
    renderListings(allListings);
}

function renderListings(listings) {
    const container = document.getElementById('listings-container');
    container.innerHTML = '';
    
    if(listings.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#888;">لا توجد عناصر متاحة حالياً</div>';
        return;
    }

    listings.forEach(item => {
        // تحديد الصورة الافتراضية حسب النوع
        let defaultImg = 'https://placehold.co/400x300?text=No+Image';
        if(item.images && item.images.length > 0) defaultImg = item.images[0];
        else if (item.type === 'car') defaultImg = 'https://placehold.co/400x300?text=Car';
        
        // حساب المسافة (محاكاة)
        const dist = item.lat ? '2.5 كم' : '';

        const card = document.createElement('div');
        card.className = 'listing-card';
        card.onclick = () => showDetails(item);
        card.innerHTML = `
            <img src="${defaultImg}" class="listing-img" loading="lazy">
            <div class="listing-info">
                <div class="listing-header">
                    <div class="listing-title">${item.name}</div>
                    <div class="listing-rating"><i class="fas fa-star"></i> ${item.rating}</div>
                </div>
                <div class="listing-loc">
                    <i class="fas fa-map-marker-alt"></i> ${item.location_text || 'موقع محدد'} ${dist ? `(${dist})` : ''}
                </div>
                <span class="listing-price">${formatPrice(item.price)} ر.ي</span>
            </div>
        `;
        container.appendChild(card);
    });
}

function filterCategory(type, element) {
    // تحديث الـ UI
    document.querySelectorAll('.cat-item').forEach(c => c.classList.remove('active'));
    element.classList.add('active');
    loadListings(type);
}

function showDetails(item) {
    document.getElementById('detail-img').src = (item.images && item.images[0]) ? item.images[0] : 'https://placehold.co/600x400';
    document.getElementById('detail-name').innerText = item.name;
    document.getElementById('detail-loc').innerText = item.location_text;
    document.getElementById('detail-price').innerText = formatPrice(item.price);
    document.getElementById('detail-desc-text').innerText = item.description || 'لا يوجد وصف متاح';
    
    // تبديل الشاشة
    document.getElementById('details-screen').style.display = 'flex';
    // تخزين العنصر الحالي للحجز
    window.currentItem = item;
}

function goBack() {
    document.getElementById('details-screen').style.display = 'none';
}

// --- وظائف الخريطة ---
function openMap() {
    document.getElementById('map-screen').style.display = 'flex';
    if (!map) {
        // مركز افتراضي (صنعاء)
        map = L.map('map-view').setView([15.3694, 44.1910], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        
        // تحديد موقع المستخدم
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                map.setView([lat, lng], 14);
                L.marker([lat, lng]).addTo(map).bindPopup('موقعك الحالي').openPopup();
                
                // البحث عن أقرب القاعات
                findNearestListings(lat, lng);
            });
        }
    }
    // إضافة علامات للقاعات
    allListings.forEach(item => {
        if(item.lat && item.lng) {
            L.marker([item.lat, item.lng])
             .addTo(map)
             .bindPopup(`<b>${item.name}</b><br>${item.price} ر.ي<br><button onclick="showDetailsFromMap(${item.id})">التفاصيل</button>`);
        }
    });
}

function closeMap() {
    document.getElementById('map-screen').style.display = 'none';
}

// --- الحجز ---
function openBookingModal() {
    document.getElementById('booking-modal').style.display = 'flex';
}
function closeBookingModal() {
    document.getElementById('booking-modal').style.display = 'none';
}

async function submitBooking() {
    const data = {
        user_id: currentUser.id,
        listing_id: window.currentItem.id,
        date: document.getElementById('book-date').value,
        time: document.getElementById('book-time').value,
        guests: document.getElementById('book-guests').value,
        notes: document.getElementById('book-notes').value
    };
    
    if(!data.date) return alert('يرجى اختيار التاريخ');
    
    const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    });
    const resp = await res.json();
    if(resp.success) {
        closeBookingModal();
        alert('تم إرسال طلبك بنجاح! سيتم التواصل معك قريباً لتأكيد الحجز.');
        goBack();
    } else {
        alert('حدث خطأ، حاول مرة أخرى');
    }
}

// أدوات مساعدة
function formatPrice(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function switchTab(tabName) {
    // منطق التبديل بين التبويبات السفلية (يمكن تنفيذه لاحقاً)
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    if(tabName === 'home') {
        document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
        document.getElementById('home-screen').style.display = 'flex';
    } else {
        alert('ميزة ' + tabName + ' قيد التطوير في هذا العرض التجريبي');
    }
}
