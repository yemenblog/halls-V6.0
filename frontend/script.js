const extras = [
    { id: 1, name: "كوشة", price: 30000 },
    { id: 2, name: "تصوير فيديو", price: 20000 },
    { id: 3, name: "دي جي", price: 10000 },
    { id: 4, name: "بوفيه مفتوح", price: 5000000 }
];

let hallsData = [];
let selectedHall = null;
let selectedBooking = null;

function switchScreen(screenName) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.querySelector(`.${screenName}-screen`);
    if (screen) {
        screen.classList.add('active');
    } else {
        alert('الشاشة غير موجودة: ' + screenName + '-screen');
    }
    if (screenName === 'home') loadHalls();
    if (screenName === 'bookings') loadBookings();
    if (screenName === 'favorites') loadFavorites();
    if (screenName === 'profile') showProfileData();
}

async function loadHalls() {
    const hallsList = document.getElementById('halls-list');
    if (!hallsList) return;
    hallsList.innerHTML = '<div style="text-align:center;padding:30px;">جاري التحميل...</div>';
    const res = await fetch('/api/halls');
    hallsData = await res.json();
    renderHalls(hallsData);
}

function renderHalls(halls) {
    const hallsList = document.getElementById('halls-list');
    const user = JSON.parse(localStorage.getItem('user'));
    let favorites = [];
    if (user && localStorage.getItem('favorites')) {
        favorites = JSON.parse(localStorage.getItem('favorites'));
    }
    hallsList.innerHTML = '';
    if (!halls.length) {
        hallsList.innerHTML = '<div style="color:#888;text-align:center;">لا توجد قاعات متاحة</div>';
        return;
    }

    halls.forEach(async hall => {
        const isFav = favorites.includes(hall.id);
        let cover = 'default.jpg';
        if (hall.image) {
            const images = await fetch(`/api/hall-images/${hall.image}`).then(r => r.json());
            if (images.length) cover = images[0];
        }
        const card = document.createElement('div');
        card.className = 'hall-card';
        card.innerHTML = `
            <div class="hall-image" style="position:relative;height:160px;overflow:hidden;border-radius:12px 12px 0 0;">
                <img src="${cover}" alt="${hall.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;">
                <i class="fa-heart ${isFav ? 'fas' : 'far'} fav-btn" data-hall="${hall.id}" style="position:absolute;top:10px;left:10px;color:#e53935;cursor:pointer;font-size:22px;z-index:2;"></i>
            </div>
            <div class="hall-info">
                <h3 class="hall-name">${hall.name}</h3>
                <div class="hall-location">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${hall.location}</span>
                </div>
                <div class="hall-rating">
                    <i class="fas fa-star"></i>
                    <span>${hall.rating || 0}</span>
                </div>
                <div class="hall-views">
                    <i class="fas fa-eye"></i>
                    <span>${hall.views || 0} مشاهدة</span>
                </div>
            </div>
        `;
        // زر اللايك
        const favBtn = card.querySelector('.fav-btn');
        favBtn.onclick = async function(e) {
            e.stopPropagation();
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user) return alert('يجب تسجيل الدخول');
            let favorites = [];
            if (localStorage.getItem('favorites')) {
                favorites = JSON.parse(localStorage.getItem('favorites'));
            }
            if (favorites.includes(hall.id)) {
                await fetch('/api/favorites', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: user.id, hall_id: hall.id })
                });
                favorites = favorites.filter(id => id !== hall.id);
                this.classList.remove('fas');
                this.classList.add('far');
            } else {
                await fetch('/api/favorites', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: user.id, hall_id: hall.id })
                });
                favorites.push(hall.id);
                this.classList.remove('far');
                this.classList.add('fas');
            }
            localStorage.setItem('favorites', JSON.stringify(favorites));
        };
        // كليك الكارد نفسه
        card.onclick = (e) => {
            if (e.target.classList.contains('fav-btn')) return;
            showHallDetails(hall.id);
        };
        const starsDiv = card.querySelector('.hall-rating-stars');
        if (starsDiv) {
            starsDiv.querySelectorAll('.star-svg').forEach(star => {
                star.onclick = async function(e) {
                    e.stopPropagation();
                    const rating = parseInt(this.dataset.star);
                    const user = JSON.parse(localStorage.getItem('user'));
                    if (!user) return alert('يجب تسجيل الدخول');
                    await fetch(`/api/halls/${hall.id}/reviews`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: user.id, comment: '', rating })
                    });
                    alert('تم تسجيل تقييمك!');
                    loadHalls();
                };
            });
        }
        hallsList.appendChild(card);
    });
}



async function showHallDetails(hallId) {
    switchScreen('hall-details');
    // إعادة ضبط الصورة الرئيسية وإزالة الفيديو إذا كان موجود
    document.getElementById('main-hall-image').style.display = '';
    const oldVideo = document.getElementById('main-hall-video');
    if (oldVideo) oldVideo.remove();

    const res = await fetch(`/api/halls/${hallId}`);
    let hall = await res.json();
    selectedHall = hall;

    let folder = hall.image || hall.images;
    let images = [];
    if (folder) {
        images = await fetch(`/api/hall-images/${folder}`).then(r => r.json());
    }
    if (!images.length) images = ['default.jpg'];

    const mainImage = images[0] || '';
    document.getElementById('main-hall-image').src = mainImage;

    const thumbnails = document.getElementById('thumbnails');
    thumbnails.innerHTML = '';

    let currentIndex = 0;
    function showImage(idx, direction = null) {
        const mainImageDiv = document.getElementById('main-image-slider');
        const mainImg = document.getElementById('main-hall-image');
        if (direction) {
            mainImageDiv.classList.add(direction === 'left' ? 'slide-left' : 'slide-right');
            setTimeout(() => {
                mainImg.src = images[idx];
                mainImageDiv.classList.remove('slide-left', 'slide-right');
            }, 200);
        } else {
            mainImg.src = images[idx];
        }
        currentIndex = idx;
        Array.from(document.querySelectorAll('.thumbnail')).forEach((el, i) => {
            el.classList.toggle('active', i === idx);
        });
        mainImg.style.display = '';
        const videoFrame = document.getElementById('main-hall-video');
        if (videoFrame) videoFrame.remove();
    }
    showImage(0);

    // أضف صور القاعة كثامبنيلز
    images.forEach((img, idx) => {
        const thumb = document.createElement('img');
        thumb.src = img;
        thumb.className = 'thumbnail' + (idx === 0 ? ' active' : '');
        thumb.style = 'width:60px;height:60px;object-fit:cover;margin-left:8px;cursor:pointer;border-radius:8px;';
        thumb.onclick = () => showImage(idx);
        thumbnails.appendChild(thumb);
    });

    // إذا فيه فيديو يوتيوب أضف له thumbnail
    if (hall.youtube) {
        // استخراج كود الفيديو من الرابط
        let videoId = '';
        try {
            const url = new URL(hall.youtube);
            if (url.hostname.includes('youtu')) {
                if (url.searchParams.get('v')) {
                    videoId = url.searchParams.get('v');
                } else if (url.pathname.startsWith('/embed/')) {
                    videoId = url.pathname.split('/embed/')[1];
                } else if (url.pathname.length > 1) {
                    videoId = url.pathname.slice(1);
                }
            }
        } catch {
            videoId = hall.youtube;
        }
        if (videoId) {
            // صورة مصغرة للفيديو
            const videoThumb = document.createElement('img');
            videoThumb.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
            videoThumb.className = 'thumbnail';
            videoThumb.style = 'width:60px;height:60px;object-fit:cover;margin-left:8px;cursor:pointer;border-radius:8px;border:2px solid #e53935;';
            videoThumb.title = 'مشاهدة الفيديو';
            videoThumb.onclick = () => {
                document.getElementById('main-hall-image').style.display = 'none';
                let videoFrame = document.getElementById('main-hall-video');
                if (!videoFrame) {
                    videoFrame = document.createElement('iframe');
                    videoFrame.id = 'main-hall-video';
                    videoFrame.width = "100%";
                    videoFrame.height = "320";
                    videoFrame.style.borderRadius = "12px";
                    videoFrame.style.margin = "auto";
                    videoFrame.style.display = "block";
                    videoFrame.src = `https://www.youtube.com/embed/${videoId}`;
                    videoFrame.frameBorder = "0";
                    videoFrame.allowFullscreen = true;
                    document.querySelector('.main-image').appendChild(videoFrame);
                }
            };
            thumbnails.appendChild(videoThumb);
        }
    }

    // دعم السحب يمين/يسار
    const mainImageDiv = document.getElementById('main-image-slider');
    let startX = null;
    mainImageDiv.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
    });
    mainImageDiv.addEventListener('touchend', e => {
        if (startX === null) return;
        let endX = e.changedTouches[0].clientX;
        if (endX - startX > 40 && currentIndex > 0) {
            showImage(currentIndex - 1);
        } else if (startX - endX > 40 && currentIndex < images.length - 1) {
            showImage(currentIndex + 1);
        }
        startX = null;
    });
    // دعم السحب بالماوس (للكمبيوتر)
    let mouseDown = false, mouseStartX = null;
    mainImageDiv.addEventListener('mousedown', e => {
        mouseDown = true;
        mouseStartX = e.clientX;
    });
    mainImageDiv.addEventListener('mouseup', e => {
        if (!mouseDown) return;
        let endX = e.clientX;
        if (endX - mouseStartX > 40 && currentIndex > 0) {
            showImage(currentIndex - 1);
        } else if (mouseStartX - endX > 40 && currentIndex < images.length - 1) {
            showImage(currentIndex + 1);
        }
        mouseDown = false;
        mouseStartX = null;
    });

    // باقي تعبئة البيانات كما هو
    document.getElementById('hall-name').textContent = hall.name || '';
    document.getElementById('hall-rating').textContent = hall.rating || 0;
    document.getElementById('hall-location').textContent = hall.location || '';
    document.getElementById('hall-likes').textContent = hall.likes || '0';
    document.getElementById('hall-views').textContent = hall.views || '0';
    document.getElementById('hall-comments-count').textContent = hall.comments_count || '0';

    // زر التعليقات الجانبي
    document.getElementById('show-comments-float-btn').onclick = function() {
        document.getElementById('comments-bottom-sheet').classList.add('active');
        loadReviewsBottomSheet(selectedHall.id);
    };

    // زر اللايك الجانبي (نفس منطق زر التفاصيل)
    document.getElementById('like-btn').onclick = async function() {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) return alert('يجب تسجيل الدخول');
        let favorites = [];
        if (localStorage.getItem('favorites')) {
            favorites = JSON.parse(localStorage.getItem('favorites'));
        }
        if (favorites.includes(hall.id)) {
            await fetch('/api/favorites', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, hall_id: hall.id })
            });
            favorites = favorites.filter(id => id !== hall.id);
            this.classList.remove('fas');
            this.classList.add('far');
        } else {
            await fetch('/api/favorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, hall_id: hall.id })
            });
            favorites.push(hall.id);
            this.classList.remove('far');
            this.classList.add('fas');
        }
        localStorage.setItem('favorites', JSON.stringify(favorites));
    };

    // تحديث حالة زر اللايك العلوي حسب المفضلة
    const user = JSON.parse(localStorage.getItem('user'));
    let favorites = [];
    if (user && localStorage.getItem('favorites')) {
        favorites = JSON.parse(localStorage.getItem('favorites'));
    }
    const likeBtn = document.getElementById('like-btn');
    if (favorites.includes(hall.id)) {
        likeBtn.querySelector('i').classList.add('fas');
        likeBtn.querySelector('i').classList.remove('far');
    } else {
        likeBtn.querySelector('i').classList.remove('fas');
        likeBtn.querySelector('i').classList.add('far');
    }
    document.getElementById('hall-likes').textContent = hall.likes || '0';

    // عند الضغط على زر اللايك العلوي
    likeBtn.onclick = async function() {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) return alert('يجب تسجيل الدخول');
        let favorites = [];
        if (localStorage.getItem('favorites')) {
            favorites = JSON.parse(localStorage.getItem('favorites'));
        }
        if (favorites.includes(hall.id)) {
            await fetch('/api/favorites', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, hall_id: hall.id })
            });
            favorites = favorites.filter(id => id !== hall.id);
            likeBtn.querySelector('i').classList.remove('fas');
            likeBtn.querySelector('i').classList.add('far');
        } else {
            await fetch('/api/favorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, hall_id: hall.id })
            });
            favorites.push(hall.id);
            likeBtn.querySelector('i').classList.remove('far');
            likeBtn.querySelector('i').classList.add('fas');
        }
        localStorage.setItem('favorites', JSON.stringify(favorites));
        // يمكنك تحديث عدد اللايكات من السيرفر إذا أردت
    };

    // تحميل التعليقات
    loadReviews(hall.id);

    // زر احجز الآن
    document.getElementById('book-now-btn').onclick = function() {
        showBookingScreen(hall);
    };
}

// فتح التعليقات
document.getElementById('show-comments-btn').onclick = function() {
    document.getElementById('comments-bottom-sheet').classList.add('active');
    document.body.style.overflow = 'hidden';
    loadReviewsBottomSheet(selectedHall.id);
};
// إغلاق بالسحب أو الضغط خارج
let sheet = document.getElementById('comments-bottom-sheet');
let dragBar = sheet.querySelector('.drag-bar');
let startY = null, isDragging = false, sheetStartBottom = 0;

dragBar.addEventListener('touchstart', e => {
    isDragging = true;
    startY = e.touches[0].clientY;
    sheetStartBottom = parseInt(window.getComputedStyle(sheet).bottom) || 0;
    sheet.style.transition = 'none';
    document.body.style.overflow = 'hidden';
    // منع تمرير الصفحة أثناء السحب
    e.preventDefault();
}, { passive: false });

dragBar.addEventListener('touchmove', e => {
    if (!isDragging) return;
    let moveY = e.touches[0].clientY;
    let diff = moveY - startY;
    let newBottom = sheetStartBottom - diff;
    if (newBottom > 0) newBottom = 0;
    sheet.style.bottom = `${newBottom}px`;
    // منع تمرير الصفحة أثناء السحب
    e.preventDefault();
}, { passive: false });

dragBar.addEventListener('touchend', e => {
    isDragging = false;
    sheet.style.transition = '';
    document.body.style.overflow = '';
    let moveY = e.changedTouches[0].clientY;
    let diff = moveY - startY;
    // إذا سحب للأسفل أكثر من 80px يغلق الشيت
    if (diff > 80) {
        sheet.classList.remove('active');
        sheet.style.bottom = '';
    } else {
        // يرجع الشيت لمكانه الطبيعي
        sheet.style.bottom = '';
    }
});
// إغلاق بالضغط خارج الشيت
sheet.addEventListener('transitionend', () => {
    if (!sheet.classList.contains('active')) {
        document.body.style.overflow = '';
    }
});
sheet.addEventListener('click', e => {
    if (e.target === sheet) {
        sheet.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// تحميل التعليقات في الشيت
function loadReviewsBottomSheet(hallId) {
    fetch(`/api/halls/${hallId}/reviews`)
        .then(res => res.json())
        .then(reviews => {
            const list = document.getElementById('comments-list');
            list.innerHTML = '';
            if (!reviews.length) {
                list.innerHTML = '<div style="color:#888;text-align:center;">لا توجد تعليقات بعد.</div>';
                return;
            }
            reviews.forEach(r => {
                const div = document.createElement('div');
                div.style = 'background:#f8f8f8;border-radius:8px;padding:10px 12px;margin-bottom:10px;';
                div.innerHTML = `
                    <div style="display:flex;align-items:center;margin-bottom:4px;">
                        <b style="margin-left:8px;">${r.user_name || 'مستخدم'}</b>
                        <span>${'★'.repeat(r.rating)}</span>
                        <span style="color:#aaa;font-size:12px;margin-right:auto;">${new Date(r.created_at).toLocaleDateString('ar-EG')}</span>
                    </div>
                    <div style="color:#333;">${r.comment}</div>
                `;
                list.appendChild(div);
            });
        });
}

// إرسال تعليق من الشيت
document.getElementById('send-comment-btn').onclick = function() {
    const comment = document.getElementById('comment-input').value.trim();
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return alert('يجب تسجيل الدخول');
    if (!comment) return alert('يرجى كتابة تعليق');
    fetch(`/api/halls/${selectedHall.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, comment, rating: 5 })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            document.getElementById('comment-input').value = '';
            loadReviewsBottomSheet(selectedHall.id);
        } else {
            alert('حدث خطأ أثناء إضافة التعليق');
        }
    });
};


function loadReviews(hallId) {
    fetch(`/api/halls/${hallId}/reviews`)
        .then(res => res.json())
        .then(reviews => {
            const list = document.getElementById('reviews-list');
            list.innerHTML = '';
            if (!reviews.length) {
                list.innerHTML = '<div style="color:#888;text-align:center;">لا توجد تعليقات بعد.</div>';
                return;
            }
            reviews.forEach(r => {
                const div = document.createElement('div');
                div.style = 'background:#f8f8f8;border-radius:8px;padding:10px 12px;margin-bottom:10px;';
                div.innerHTML = `
                    <div style="display:flex;align-items:center;margin-bottom:4px;">
                        <b style="margin-left:8px;">${r.user_name || 'مستخدم'}</b>
                        <span>${'★'.repeat(r.rating)}</span>
                        <span style="color:#aaa;font-size:12px;margin-right:auto;">${new Date(r.created_at).toLocaleDateString('ar-EG')}</span>
                    </div>
                    <div style="color:#333;">${r.comment}</div>
                `;
                list.appendChild(div);
            });
        });

    let rating = 0;
    const starContainer = document.getElementById('star-rating');
    starContainer.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('i');
        star.className = 'fa-star far';
        star.style.color = '#FFD600';
        star.style.cursor = 'pointer';
        star.onclick = () => {
            rating = i;
            Array.from(starContainer.children).forEach((s, idx) => {
                s.className = idx < i ? 'fa-star fas' : 'fa-star far';
            });
        };
        starContainer.appendChild(star);
    }
    document.getElementById('submit-review-btn').onclick = function() {
        const comment = document.getElementById('review-comment').value.trim();
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) return alert('يجب تسجيل الدخول');
        if (!comment || rating === 0) return alert('يرجى كتابة تعليق واختيار التقييم.');
        fetch(`/api/halls/${selectedHall.id}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id, comment, rating })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                document.getElementById('review-comment').value = '';
                rating = 0;
                Array.from(starContainer.children).forEach(s => s.className = 'fa-star far');
                loadReviews(selectedHall.id);
            } else {
                alert('حدث خطأ أثناء إضافة التعليق');
            }
        });
    };
}

async function showBookingScreen(hall) {
    selectedHall = hall;
    console.log('فتح شاشة الحجز', hall);

    let folder = hall.image || hall.images;
    let images = [];
    if (folder) {
        images = await fetch(`/api/hall-images/${folder}`).then(r => r.json());
    }
    let mainImage = images[0] || 'default.jpg';
    document.getElementById('booking-hall-image').src = mainImage;

    document.getElementById('booking-hall-name').textContent = hall.name;
    document.getElementById('booking-hall-location').textContent = hall.location;
    document.getElementById('booking-date').value = '';
    document.getElementById('booking-time').value = '18:00';
    document.getElementById('guest-count').textContent = '100';
    document.getElementById('booking-notes').value = '';
    renderExtras();

    // فحص وجود العنصر قبل التبديل
    if (!document.querySelector('.booking-screen')) {
        alert('عنصر شاشة الحجز غير موجود في الصفحة!');
        return;
    }
    switchScreen('booking');
}

function renderExtras() {
    const extrasList = document.getElementById('extras-list');
    extrasList.innerHTML = '';
    extras.forEach(extra => {
        extrasList.innerHTML += `
            <label style="display:block;margin-bottom:6px;">
                <input type="checkbox" class="extra-checkbox" value="${extra.id}">
                ${extra.name} <span style="color:#888;font-size:13px;">(من ${extra.price} ر.ي)</span>
            </label>
        `;
    });
}

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.counter-btn.minus').forEach(btn => {
        btn.onclick = function() {
            const countElement = document.getElementById('guest-count');
            let count = parseInt(countElement.textContent);
            if (count > 50) {
                count -= 10;
                countElement.textContent = count;
            }
        };
    });
    document.querySelectorAll('.counter-btn.plus').forEach(btn => {
        btn.onclick = function() {
            const countElement = document.getElementById('guest-count');
            let count = parseInt(countElement.textContent);
            if (count < 500) {
                count += 10;
                countElement.textContent = count;
            }
        };
    });
});

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('confirm-booking-btn').onclick = async function() {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) return alert('يجب تسجيل الدخول');
        const hall = selectedHall;
        if (!hall) return alert('لم يتم اختيار قاعة');
        const date = document.getElementById('booking-date').value;
        const time = document.getElementById('booking-time').value;
        const guests = document.getElementById('guest-count').textContent;
        const notes = document.getElementById('booking-notes').value;
        const checkedExtras = Array.from(document.querySelectorAll('.extra-checkbox:checked')).map(cb => {
            const extra = extras.find(e => e.id == cb.value);
            return { id: extra.id, name: extra.name, price: extra.price };
        });
        if (!date || !time) return alert('يرجى اختيار التاريخ والوقت');
        fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: user.id,
                hall_id: hall.id,
                date,
                time,
                guests,
                notes,
                extras: JSON.stringify(checkedExtras)
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.id) {
                alert('تم إرسال الحجز بنجاح. سيتم التواصل معك قريباً بخصوص السعر وموعد الحجز.');
                switchScreen('bookings');
                loadBookings();
            } else {
                alert('حدث خطأ أثناء الحجز');
            }
        });
    };
});

async function loadBookings() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;
    const res = await fetch(`/api/bookings/${user.id}`);
    const bookingsList = document.getElementById('bookings-list');
    bookingsList.innerHTML = '';
    const bookings = await res.json();
    if (bookings.length) {
        bookings.forEach(b => {
            let extrasHtml = '';
            if (b.extras) {
                try {
                    const extrasArr = typeof b.extras === 'string' ? JSON.parse(b.extras) : b.extras;
                    if (extrasArr && extrasArr.length) {
                        extrasHtml = `<div class="extras"><b>الإضافات:</b> ${extrasArr.map(e => `${e.name} (${e.price} ر.ي)`).join('، ')}</div>`;
                    }
                } catch {}
            }
            let status = 'معلقة';
            let statusColor = '#ff9800';
            if (b.status === 'approved') {
                status = 'تم الحجز';
                statusColor = '#4caf50';
            } else if (b.status === 'deposit') {
                status = 'تم دفع عربون';
                statusColor = '#2196f3';
            } else if (b.status === 'canceled_user') {
                status = 'ملغاة (من المستخدم)';
                statusColor = '#f44336';
            } else if (b.status === 'canceled_admin') {
                status = 'ملغاة (من الإدارة)';
                statusColor = '#f44336';
            }
            bookingsList.innerHTML += `
                <div class="booking-card" style="border:1px solid #eee;padding:15px;margin-bottom:15px;border-radius:10px;box-shadow:0 2px 8px #0001;cursor:pointer;" onclick="showBookingDetails(${b.id})">
                    <div style="display:flex;align-items:center;gap:15px;">
                        <div style="flex:1">
                            <h4 style="margin:0 0 5px 0;">${b.name || b.hall_name || 'قاعة'}</h4>
                            <div style="font-size:14px;color:#666;">${b.location || ''}</div>
                            <div style="font-size:14px;">التاريخ: <b>${b.date}</b> - الساعة: <b>${b.time || '-'}</b></div>
                            <div style="font-size:14px;">عدد الضيوف: <b>${b.guests}</b></div>
                            <div style="font-size:14px;">عدد النجوم: <b>${b.rating || '-'}</b></div>
                            <div style="font-size:14px;">عدد المشاهدات: <b>${b.views || 0}</b></div>
                            <div style="font-size:14px;">ملاحظات: <b>${b.notes || '-'}</b></div>
                            ${extrasHtml}
                        </div>
                        <span style="padding:6px 14px;border-radius:20px;font-size:13px;color:#fff;background:${statusColor};white-space:nowrap">${status}</span>
                    </div>
                </div>
            `;
        });
    } else {
        bookingsList.innerHTML = '<p>لا توجد حجوزات بعد.</p>';
    }
}

window.showBookingDetails = async function(bookingId) {
    const res = await fetch(`/api/booking/${bookingId}`);
    const b = await res.json();
    selectedBooking = b;
    let extrasHtml = '';
    if (b.extras) {
        try {
            const extrasArr = typeof b.extras === 'string' ? JSON.parse(b.extras) : b.extras;
            if (extrasArr && extrasArr.length) {
                extrasHtml = `<div class="extras"><b>الإضافات:</b> ${extrasArr.map(e => `${e.name} (${e.price} ر.ي)`).join('، ')}</div>`;
            }
        } catch {}
    }
    loadChatMessages(bookingId);
    loadBookings();
    switchScreen('booking-details');
};

function loadChatMessages(bookingId) {
    fetch(`/api/messages/${selectedBooking.booking_number}`)
        .then(res => res.json())
        .then(messages => {
            const chat = document.getElementById('chat-messages');
            chat.innerHTML = '';
            messages.forEach(msg => {
                const div = document.createElement('div');
                div.className = msg.sender === 'user' ? 'chat-msg user' : 'chat-msg admin';
                div.innerHTML = `<span>${msg.message}</span><div class="chat-time">${new Date(msg.created_at).toLocaleTimeString('ar-EG')}</div>`;
                chat.appendChild(div);
            });
            chat.scrollTop = chat.scrollHeight;
            loadChatMessages(bookingId);
        });
}
document.getElementById('send-chat-btn').onclick = function() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message || !selectedBooking) return;
    fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_number: selectedBooking.booking_number, sender: 'user', message })
    }).then(() => {
        input.value = '';
        loadChatMessages(selectedBooking.id);
    });
};

async function loadFavorites() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;
    const res = await fetch(`/api/favorites/${user.id}`);
    const favoritesList = document.getElementById('favorites-list');
    const halls = await res.json();
    favoritesList.innerHTML = '';
    if (!halls.length) {
        favoritesList.innerHTML = '<div style="color:#888;text-align:center;">لا توجد قاعات مفضلة</div>';
        return;
    }
    for (const hall of halls) {
        // جلب أول صورة من مجلد القاعة
        let cover = 'default.jpg';
        if (hall.image) {
            const images = await fetch(`/api/hall-images/${hall.image}`).then(r => r.json());
            if (images.length) cover = images[0];
        }
        const card = document.createElement('div');
        card.className = 'hall-card';
        card.innerHTML = `
            <div class="hall-image">
                <img src="${cover}" alt="${hall.name}" loading="lazy">
            </div>
            <div class="hall-info">
                <h3 class="hall-name">${hall.name}</h3>
                <div class="hall-location">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${hall.location}</span>
                </div>
                <div class="hall-rating">
                    <i class="fas fa-star"></i>
                    <span>${hall.rating || 0}</span>
                </div>
                <div class="hall-views">
                    <i class="fas fa-eye"></i>
                    <span>${hall.views || 0} مشاهدة</span>
                </div>
            </div>
        `;
        card.onclick = () => showHallDetails(hall.id);
        favoritesList.appendChild(card);
    }
}

function showProfileData() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        document.getElementById('profile-name').textContent = user.name || '';
        document.getElementById('profile-phone').textContent = user.phone ? ('' + user.phone) : '';
        document.getElementById('edit-profile-id').value = user.id || '';
        document.getElementById('edit-profile-name').value = user.name || '';
    }
}

async function updateFavorites() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;
    const res = await fetch(`/api/favorites/${user.id}`);
    const halls = await res.json();
    const favIds = halls.map(h => h.id);
    localStorage.setItem('favorites', JSON.stringify(favIds));
}
updateFavorites();

document.addEventListener('DOMContentLoaded', function() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (user && user.id) {
        switchScreen('home');
    } else {
        switchScreen('login');
    }

    document.getElementById('login-btn').onclick = async function() {
        const phone = document.getElementById('login-phone').value.trim();
        const password = document.getElementById('login-password').value;
        if (!/^7\d{8}$/.test(phone)) {
            alert('يرجى إدخال رقم صحيح يبدأ بـ7 ويتكون من 9 أرقام');
            return;
        }
        if (!password) {
            alert('يرجى إدخال كلمة المرور');
            return;
        }
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, password })
        });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('user', JSON.stringify(data.user));
            switchScreen('home');
        } else {
            alert(data.error || 'بيانات الدخول غير صحيحة');
        }
    };

    document.getElementById('register-btn').onclick = async function() {
        const name = document.getElementById('register-name').value.trim();
        const phone = document.getElementById('register-phone').value.trim();
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;
        if (!name || !/^7\d{8}$/.test(phone) || !password) {
            alert('يرجى إدخال جميع البيانات بشكل صحيح');
            return;
        }
        if (password !== confirmPassword) {
            alert('كلمة المرور غير متطابقة');
            return;
        }
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, password })
        });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('user', JSON.stringify(data.user));
            switchScreen('home');
        } else {
            alert(data.error || 'بيانات التسجيل غير صحيحة');
        }
    };

    document.getElementById('register-link').onclick = function(e) {
        e.preventDefault();
        switchScreen('register');
    };
    document.getElementById('login-link').onclick = function(e) {
        e.preventDefault();
        switchScreen('login');
    };

    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const screen = this.closest('.screen').classList[1];
            if (screen === 'hall-details-screen') {
                switchScreen('home');
            } else if (screen === 'booking-screen') {
                switchScreen('hall-details');
            } else if (screen === 'profile-screen') {
                switchScreen('home');
            } else if (screen === 'bookings-screen') {
                switchScreen('home');
            } else if (screen === 'edit-profile-screen') {
                switchScreen('profile');
            } else if (screen === 'help-screen') {
                switchScreen('profile');
            } else if (screen === 'favorites-screen') {
                switchScreen('home');
            } else if (screen === 'booking-details-screen') {
                switchScreen('bookings');
            }
        });
    });

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const target = this.dataset.screen;
            switchScreen(target);
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            if (target === 'wallet') showWallet();
        });
        const walletBackBtn = document.querySelector('.wallet-screen .back-btn');
        if (walletBackBtn) {
            walletBackBtn.onclick = function() {
                switchScreen('home');
            };
        }
    });

    document.getElementById('edit-profile-btn').onclick = function() {
        showProfileData();
        switchScreen('edit-profile');
    };
    document.getElementById('save-profile-btn').onclick = function() {
        let id = document.getElementById('edit-profile-id').value;
        const name = document.getElementById('edit-profile-name').value.trim();
        if (!name) {
            alert('يرجى إدخال الاسم');
            return;
        }
        fetch('/api/set-name', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name })
        })
        .then(res => res.json())
        .then(response => {
            if (response.success) {
                let user = JSON.parse(localStorage.getItem('user'));
                if (user) {
                    user.name = name;
                    localStorage.setItem('user', JSON.stringify(user));
                    document.getElementById('profile-name').textContent = name;
                }
                switchScreen('profile');
            } else {
                alert('حدث خطأ أثناء الحفظ');
            }
        });
    };

    document.getElementById('my-bookings-btn').onclick = function() {
        switchScreen('bookings');
        loadBookings();
    };
    document.getElementById('my-favorites-btn').onclick = function() {
        switchScreen('favorites');
        loadFavorites();
    };
    document.getElementById('help-btn').onclick = function() {
        switchScreen('help');
    };
    document.getElementById('logout-btn').onclick = function() {
        localStorage.removeItem('user');
        switchScreen('login');
    };

    document.getElementById('user-avatar').onclick = function() {
        switchScreen('profile');
        showProfileData();
    };
});

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('search-input').addEventListener('input', function() {
        const q = this.value.trim();
        let filtered = hallsData.filter(hall =>
            hall.name.includes(q) || hall.location.includes(q)
        );
        renderHalls(filtered);
    });

    document.querySelectorAll('.category').forEach(cat => {
        cat.onclick = function() {
            document.querySelectorAll('.category').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            let filtered = hallsData;
            if (this.dataset.category === 'luxury') {
                filtered = hallsData.filter(h => h.price >= 100000);
            } else if (this.dataset.category === 'economy') {
                filtered = hallsData.filter(h => h.price < 100000);
            }
            renderHalls(filtered);
        };
    });

    // تحية صباحية أو مسائية مع تلوين الاسم والتحية
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        const now = new Date();
        const hour = now.getHours();
        let greeting = '';
        let greetingColor = '';
        if (hour >= 5 && hour < 18) {
            greeting = 'صباح الخير';
            greetingColor = '#2196f3';
        } else {
            greeting = 'مساء الخير';
            greetingColor = '#ff9800';
        }
        const greetingHtml = `
            <span style="color:${greetingColor};font-weight:bold;">${greeting}</span>
            <span style="color:#353535;font-weight:bold;">${user.name}</span>
        `;
        const greetingEl = document.getElementById('greeting');
        if (greetingEl) {
            greetingEl.innerHTML = greetingHtml;
        }
    }
});



async function showWallet() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;
    fetch(`/api/wallet/${user.id}`)
        .then(res => res.json())
        .then(data => {
            document.getElementById('wallet-balance').textContent = `الرصيد: ${data.balance} ر.ي`;
            if (data.bonus_expiry) {
                const expiry = new Date(data.bonus_expiry);
                const now = new Date();
                if (expiry > now) {
                    document.getElementById('wallet-bonus-expiry').textContent = `رصيد افتتاحي صالح حتى: ${expiry.toLocaleDateString('ar-EG')}`;
                } else {
                    document.getElementById('wallet-bonus-expiry').textContent = '';
                }
            }
            const list = document.getElementById('wallet-transactions');
            list.innerHTML = '';
            if (data.transactions.length) {
                data.transactions.forEach(tr => {
                    list.innerHTML += `
                        <div style="background:#fafbfc;border-radius:10px;padding:14px;margin-bottom:10px;box-shadow:0 1px 4px #0001;">
                            <div style="font-size:1.1em;">
                                <b>${tr.amount > 0 ? '+' : ''}${tr.amount} ر.ي</b>
                                <span style="color:#888;font-size:13px;margin-right:8px;">${tr.type === 'bonus' ? 'رصيد افتتاحي' : tr.description || ''}</span>
                            </div>
                            <div style="color:#888;font-size:12px;">${new Date(tr.created_at).toLocaleString('ar-EG')}</div>
                        </div>
                    `;
                });
            } else {
                list.innerHTML = '<div style="color:#888;text-align:center;">لا توجد عمليات بعد.</div>';
            }
        });
}

async function checkNewMessages(userId) {
    const bookings = await fetch(`/api/bookings/${userId}`).then(r => r.json());
    let hasNew = false;
    for (const booking of bookings) {
        const messages = await fetch(`/api/messages/${booking.booking_number}`).then (r => r.json());
        if (messages.length && messages[messages.length - 1].sender === 'admin') {
            hasNew = true;
            break;
        }
    }
    document.getElementById('bookings-badge').style.display = hasNew ? 'flex' : 'none';
}

let lastMessageIds = {};

async function pollChatNotifications() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;
    const bookings = await fetch(`/api/bookings/${user.id}`).then(r => r.json());
    for (const booking of bookings) {
        const messages = await fetch(`/api/messages/${booking.booking_number}`).then(r => r.json());
        if (messages.length) {
            const lastMsg = messages[messages.length - 1];
            // إذا آخر رسالة من الإدارة ولم يتم إشعار المستخدم بها
            if (lastMsg.sender === 'admin' && lastMessageIds[booking.booking_number] !== lastMsg.id) {
                lastMessageIds[booking.booking_number] = lastMsg.id;
                if (Notification.permission === "granted") {
                    new Notification("رسالة جديدة من الإدارة", {
                        body: lastMsg.message,
                        icon: "/favicon.ico"
                    });
                }
            }
        }
    }
}
if ("Notification" in window && Notification.permission !== "granted") {
    Notification.requestPermission();
}
setInterval(pollChatNotifications, 8000); // كل 8 ثواني

let lastBookingStatuses = {};

async function pollBookingStatusNotifications() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;
    const bookings = await fetch(`/api/bookings/${user.id}`).then(r => r.json());
    for (const booking of bookings) {
        if (!lastBookingStatuses[booking.id]) {
            lastBookingStatuses[booking.id] = booking.status;
        } else if (lastBookingStatuses[booking.id] !== booking.status) {
            // الحالة تغيرت
            lastBookingStatuses[booking.id] = booking.status;
            let statusMsg = '';
            if (booking.status === 'approved') statusMsg = 'تم اعتماد حجزك للقاعة!';
            else if (booking.status === 'deposit') statusMsg = 'تم طلب عربون للحجز.';
            else if (booking.status === 'canceled_user' || booking.status === 'canceled_admin') statusMsg = 'تم إلغاء الحجز.';
            else statusMsg = 'تم تحديث حالة الحجز.';
            if (Notification.permission === "granted") {
                new Notification("تحديث حالة الحجز", {
                    body: statusMsg,
                    icon: "/favicon.ico"
                });
            }
        }
    }
}
setInterval(pollBookingStatusNotifications, 9000); // كل 9 ثواني

// منع ظهور المربع الأزرق عند الضغط أو لمس أي عنصر (focus highlight)
document.addEventListener('mousedown', function(e) {
    if (e.target) e.target.blur && e.target.blur();
}, true);
document.addEventListener('touchstart', function(e) {
    if (e.target) e.target.blur && e.target.blur();
}, true);

function getHallImages(hall) {
    // اجمع الصور غير الفارغة فقط
    return [hall.image1, hall.image2, hall.image3, hall.image4, hall.image5].filter(Boolean);
}

function getImagesArray(image) {
    if (!image) return [];
    if (Array.isArray(image)) return image;
    if (typeof image === 'string') {
        try {
            const arr = JSON.parse(image);
            if (Array.isArray(arr)) return arr;
            return [arr];
        } catch {
            return [image];
        }
    }
    return [];
}

function getHallImagesFromFolder(folderName) {
    // جرب حتى 10 صور لكل قاعة (يمكنك زيادة الرقم)
    const images = [];
    for (let i = 1; i <= 10; i++) {
        const imgPath = `image/${folderName}/${i}.jpg`;
        // نستخدم صورة افتراضية إذا لم توجد الصورة
        images.push(imgPath);
    }
    return images;
}

