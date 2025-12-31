const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const app = express();

app.use(cors());
app.use(express.json());

// تأكد من وجود المجلدات
const uploadDir = path.join(__dirname, '../frontend/image/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const db = new sqlite3.Database('./halls_v2.db');
const upload = multer({ dest: uploadDir });

db.serialize(() => {
    // 1. جدول المحافظات
    db.run(`CREATE TABLE IF NOT EXISTS governorates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
    )`);

    // 2. جدول المدن/المناطق
    db.run(`CREATE TABLE IF NOT EXISTS cities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        governorate_id INTEGER,
        name TEXT,
        FOREIGN KEY(governorate_id) REFERENCES governorates(id)
    )`);

    // 3. جدول المستخدمين (تم تحديثه بالموقع)
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT UNIQUE,
        password TEXT,
        governorate_id INTEGER,
        city_id INTEGER,
        wallet_balance INTEGER DEFAULT 0,
        wallet_bonus_expiry TEXT,
        is_blocked INTEGER DEFAULT 0
    )`);

    // 4. جدول الخدمات (قاعات، سيارات، شاليهات) - دمجناهم في جدول واحد مع نوع
    db.run(`CREATE TABLE IF NOT EXISTS listings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id INTEGER,
        type TEXT, -- 'hall', 'car', 'chalet'
        name TEXT,
        location_text TEXT,
        governorate_id INTEGER,
        lat REAL,
        lng REAL,
        price INTEGER,
        images TEXT,
        rating REAL DEFAULT 5,
        capacity INTEGER,
        description TEXT,
        youtube TEXT,
        views INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending', -- 'active', 'pending', 'disabled'
        last_edit_json TEXT, -- لتخزين التعديلات المعلقة للموافقة
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // 5. جدول الحجوزات
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_number TEXT UNIQUE,
        user_id INTEGER,
        listing_id INTEGER,
        date TEXT,
        time TEXT,
        guests INTEGER,
        notes TEXT,
        extras TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // 6. جدول الإعلانات المدفوعة
    db.run(`CREATE TABLE IF NOT EXISTS ads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image TEXT,
        title TEXT,
        link_listing_id INTEGER,
        expires_at TEXT,
        is_active INTEGER DEFAULT 1
    )`);
    
    // 7. جدول الملاك
    db.run(`CREATE TABLE IF NOT EXISTS owners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT UNIQUE,
        password TEXT,
        is_blocked INTEGER DEFAULT 0
    )`);

    // 8. المراجعات
    db.run(`CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        listing_id INTEGER,
        user_id INTEGER,
        comment TEXT,
        rating INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // إضافة بيانات أولية للمحافظات (مثال)
    db.get("SELECT count(*) as count FROM governorates", (err, row) => {
        if (row.count === 0) {
            db.run("INSERT INTO governorates (name) VALUES ('صنعاء')");
            db.run("INSERT INTO governorates (name) VALUES ('عدن')");
            db.run("INSERT INTO governorates (name) VALUES ('إب')");
            db.run("INSERT INTO governorates (name) VALUES ('تعز')");
        }
    });
});

// --- API للمواقع الجغرافية ---
app.get('/api/governorates', (req, res) => {
    db.all('SELECT * FROM governorates', (err, rows) => res.json(rows));
});
app.post('/api/governorates', (req, res) => {
    db.run('INSERT INTO governorates (name) VALUES (?)', [req.body.name], function(err) {
        if(err) return res.json({success:false});
        res.json({success:true, id: this.lastID});
    });
});
app.get('/api/cities/:gov_id', (req, res) => {
    db.all('SELECT * FROM cities WHERE governorate_id = ?', [req.params.gov_id], (err, rows) => res.json(rows));
});
app.post('/api/cities', (req, res) => {
    db.run('INSERT INTO cities (name, governorate_id) VALUES (?, ?)', [req.body.name, req.body.governorate_id], function(err) {
        if(err) return res.json({success:false});
        res.json({success:true, id: this.lastID});
    });
});

// --- API المستخدمين (تسجيل دخول اليمن فقط) ---
app.post('/api/register', (req, res) => {
    const { name, phone, password, governorate_id, city_id } = req.body;
    // التحقق من الرقم اليمني
    if (!name || !/^(77|78|73|71|70)\d{7}$/.test(phone) || !password) {
        return res.json({ success: false, error: 'بيانات غير صحيحة، تأكد من رقم الهاتف اليمني' });
    }
    const bonus = 5000;
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.run(
        'INSERT INTO users (name, phone, password, governorate_id, city_id, wallet_balance, wallet_bonus_expiry) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, phone, password, governorate_id, city_id, bonus, expiry],
        function(err) {
            if (err) return res.json({ success: false, error: 'الرقم مستخدم بالفعل' });
            res.json({ success: true, user: { id: this.lastID, name, phone, wallet_balance: bonus } });
        }
    );
});

app.post('/api/login', (req, res) => {
    const { phone, password } = req.body;
    db.get('SELECT * FROM users WHERE phone = ?', [phone], (err, user) => {
        if (!user) return res.json({ success: false, error: 'الرقم غير موجود' });
        if (user.password !== password) return res.json({ success: false, error: 'كلمة المرور خطأ' });
        if (user.is_blocked) return res.json({ success: false, error: 'تم حظر حسابك، راجع الإدارة' });
        res.json({ success: true, user });
    });
});

// --- API الخدمات (Listings) ---
app.get('/api/listings', (req, res) => {
    // جلب الخدمات النشطة فقط للواجهة الرئيسية
    const { type, gov_id } = req.query;
    let sql = "SELECT * FROM listings WHERE status = 'active'";
    let params = [];
    if (type && type !== 'all') {
        sql += " AND type = ?";
        params.push(type);
    }
    if (gov_id) {
        sql += " AND governorate_id = ?";
        params.push(gov_id);
    }
    db.all(sql, params, (err, rows) => {
        rows.forEach(r => {
            try { r.images = JSON.parse(r.images); } catch {}
        });
        res.json(rows);
    });
});

// إضافة خدمة (تحتاج موافقة)
app.post('/api/listings', (req, res) => {
    const { owner_id, type, name, location_text, price, images, description, lat, lng, governorate_id } = req.body;
    const status = 'pending'; // تنتظر موافقة الأدمن
    const imagesJson = JSON.stringify(images || []);
    db.run(
        `INSERT INTO listings (owner_id, type, name, location_text, price, images, description, lat, lng, governorate_id, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [owner_id, type, name, location_text, price, imagesJson, description, lat, lng, governorate_id, status],
        function(err) {
            if(err) return res.json({success: false, error: err.message});
            res.json({success: true, id: this.lastID});
        }
    );
});

// تعديل خدمة (يحفظ التعديل للموافقة)
app.put('/api/listings/:id', (req, res) => {
    const { name, price, description, images } = req.body;
    // هنا نقوم بحفظ التعديلات في حقل JSON ونغير الحالة لـ pending_edit أو مشابه، 
    // للتبسيط سنقوم بتحديث الحالة لـ pending ويتطلب الموافقة مرة أخرى
    const imagesJson = JSON.stringify(images);
    db.run(
        `UPDATE listings SET name=?, price=?, description=?, images=?, status='pending' WHERE id=?`,
        [name, price, description, imagesJson, req.params.id],
        function(err) {
            res.json({success: true});
        }
    );
});

// --- API الإعلانات ---
app.get('/api/ads', (req, res) => {
    db.all("SELECT * FROM ads WHERE is_active = 1", (err, rows) => res.json(rows));
});
app.post('/api/ads', (req, res) => {
    const { image, title, link_listing_id } = req.body;
    db.run("INSERT INTO ads (image, title, link_listing_id) VALUES (?, ?, ?)", [image, title, link_listing_id], function(err) {
        res.json({success: true});
    });
});

// --- API الحجوزات ---
function generateBookingNumber(callback) {
    const num = 'YE-' + Math.floor(100000 + Math.random() * 900000);
    callback(num);
}
app.post('/api/bookings', (req, res) => {
    const { user_id, listing_id, date, time, guests, notes, extras } = req.body;
    generateBookingNumber((bn) => {
        db.run(
            `INSERT INTO bookings (booking_number, user_id, listing_id, date, time, guests, notes, extras) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [bn, user_id, listing_id, date, time, guests, notes, extras],
            function(err) {
                if(err) return res.json({success: false});
                res.json({success: true, booking_number: bn});
            }
        );
    });
});

// --- API الأدمن ---
// جلب الخدمات المعلقة
app.get('/api/admin/pending-listings', (req, res) => {
    db.all("SELECT * FROM listings WHERE status = 'pending'", (err, rows) => {
        rows.forEach(r => { try { r.images = JSON.parse(r.images); } catch {} });
        res.json(rows);
    });
});
// الموافقة أو الرفض
app.post('/api/admin/approve-listing', (req, res) => {
    const { id, action } = req.body; // action: 'active', 'rejected'
    db.run("UPDATE listings SET status = ? WHERE id = ?", [action, id], (err) => {
        res.json({success: true});
    });
});
// حظر مستخدم أو مالك
app.post('/api/admin/block-user', (req, res) => {
    const { id, type, block } = req.body; // type: 'user' or 'owner'
    const table = type === 'owner' ? 'owners' : 'users';
    db.run(`UPDATE ${table} SET is_blocked = ? WHERE id = ?`, [block ? 1 : 0, id], (err) => {
        res.json({success: true});
    });
});

// رفع الصور
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.json({ error: 'No file' });
    // إرجاع المسار النسبي
    res.json({ url: `image/uploads/${req.file.filename}` });
});

// خدمة الملفات الثابتة
app.use(express.static(path.join(__dirname, '../frontend')));
app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(3001, () => console.log('Server running on port 3001'));
