const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const app = express();

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./halls.db');
const upload = multer({ dest: path.join(__dirname, '../frontend/image/uploads') });

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT UNIQUE,
        password TEXT,
        wallet_balance INTEGER DEFAULT 0,
        wallet_bonus_expiry TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS halls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        location TEXT,
        price INTEGER,
        images TEXT, -- نخزن مصفوفة روابط الصور كنص JSON
        rating REAL,
        reviews INTEGER,
        capacity INTEGER,
        description TEXT,
        youtube TEXT,
        views INTEGER DEFAULT 0
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_number TEXT UNIQUE,
        user_id INTEGER,
        hall_id INTEGER,
        date TEXT,
        time TEXT,
        guests INTEGER,
        notes TEXT,
        extras TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(hall_id) REFERENCES halls(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS favorites (
        user_id INTEGER,
        hall_id INTEGER,
        PRIMARY KEY (user_id, hall_id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hall_id INTEGER,
        user_id INTEGER,
        comment TEXT,
        rating INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(hall_id) REFERENCES halls(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_number TEXT,
        sender TEXT,
        message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS otp (
        phone TEXT PRIMARY KEY,
        code TEXT,
        expires INTEGER
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS owners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT UNIQUE,
        password TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS available_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hall_id INTEGER,
        date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS wallet_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        amount INTEGER,
        type TEXT,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
});

// تسجيل مستخدم جديد
app.post('/api/register', (req, res) => {
    const { name, phone, password } = req.body;
    if (!name || !/^7\d{8}$/.test(phone) || !password) {
        return res.json({ success: false, error: 'بيانات غير صحيحة' });
    }
    db.get('SELECT * FROM users WHERE phone = ?', [phone], (err, user) => {
        if (user) return res.json({ success: false, error: 'الحساب موجود بالفعل' });
        const bonus = 5000;
        const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        db.run(
            'INSERT INTO users (name, phone, password, wallet_balance, wallet_bonus_expiry) VALUES (?, ?, ?, ?, ?)',
            [name, phone, password, bonus, expiry],
            function(err) {
                if (err) return res.json({ success: false, error: err.message });
                db.run(
                    'INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
                    [this.lastID, bonus, 'bonus', 'رصيد افتتاحي عند التسجيل'],
                    () => {
                        db.get('SELECT id, name, phone, wallet_balance, wallet_bonus_expiry FROM users WHERE id = ?', [this.lastID], (err, newUser) => {
                            res.json({ success: true, user: newUser });
                        });
                    }
                );
            }
        );
    });
});

// تسجيل دخول مستخدم
app.post('/api/login', (req, res) => {
    const { phone, password } = req.body;
    db.get('SELECT * FROM users WHERE phone = ?', [phone], (err, user) => {
        if (!user) return res.json({ success: false, error: 'الرقم غير موجود' });
        if (user.password !== password) return res.json({ success: false, error: 'كلمة المرور غير صحيحة' });
        res.json({ success: true, user });
    });
});

// تعديل اسم المستخدم
app.post('/api/set-name', (req, res) => {
    const { id, name } = req.body;
    db.run('UPDATE users SET name = ? WHERE id = ?', [name, id], function(err) {
        if (err) return res.json({ success: false, error: 'خطأ في حفظ الاسم' });
        res.json({ success: true });
    });
});

// جلب جميع المستخدمين
app.get('/api/users', (req, res) => {
    db.all('SELECT id, name, phone FROM users', [], (err, rows) => {
        res.json(rows);
    });
});

// جلب مستخدم واحد
app.get('/api/users/:id', (req, res) => {
    db.get('SELECT id, name, phone FROM users WHERE id = ?', [req.params.id], (err, row) => {
        res.json(row || {});
    });
});

// جلب كل القاعات
app.get('/api/halls', (req, res) => {
    db.all('SELECT * FROM halls ORDER BY views DESC', [], (err, rows) => {
        // رجع الصور كمصفوفة
        rows.forEach(row => {
            if (row.images) {
                try { row.images = JSON.parse(row.images); } catch {}
            }
        });
        res.json(rows);
    });
});

// جلب تفاصيل قاعة واحدة
app.get('/api/halls/:id', (req, res) => {
    db.run('UPDATE halls SET views = views + 1 WHERE id = ?', [req.params.id], () => {
        db.get('SELECT * FROM halls WHERE id = ?', [req.params.id], (err, row) => {
            if (row && row.images) {
                try { row.images = JSON.parse(row.images); } catch {}
            }
            res.json(row || {});
        });
    });
});


app.post('/api/halls', (req, res) => {
    const { name, location, price, images, rating, reviews, capacity, description, youtube } = req.body;
    const imagesJson = JSON.stringify(images || []);
    db.run(
        'INSERT INTO halls (name, location, price, images, rating, reviews, capacity, description, youtube) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [name, location, price, imagesJson, rating, reviews, capacity, description, youtube],
        function(err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ id: this.lastID });
        }
    );
});

// تعديل قاعة (يدعم صور متعددة)
app.put('/api/halls/:id', (req, res) => {
    const { name, location, price, capacity, description, images } = req.body;
    const imagesJson = JSON.stringify(images || []);
    db.run(
        'UPDATE halls SET name=?, location=?, price=?, capacity=?, description=?, images=? WHERE id=?',
        [name, location, price, capacity, description, imagesJson, req.params.id],
        function(err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ success: true });
        }
    );

});

// إضافة تعليق
app.post('/api/halls/:hall_id/reviews', (req, res) => {
    const hall_id = req.params.hall_id;
    const { user_id, comment, rating } = req.body;
    db.run(
        'INSERT INTO reviews (hall_id, user_id, comment, rating) VALUES (?, ?, ?, ?)',
        [hall_id, user_id, comment, rating],
        function(err) {
            if (err) return res.status(500).json({ error: 'خطأ في إضافة التعليق' });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// جلب تعليقات قاعة
app.get('/api/halls/:hall_id/reviews', (req, res) => {
    const hall_id = req.params.hall_id;
    db.all(
        `SELECT reviews.*, users.name as user_name 
         FROM reviews 
         LEFT JOIN users ON reviews.user_id = users.id 
         WHERE hall_id = ? ORDER BY created_at DESC`,
        [hall_id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'خطأ في جلب التعليقات' });
            res.json(rows);
        }
    );
});

// جلب كل التعليقات
app.get('/api/all-reviews', (req, res) => {
    db.all(
        `SELECT reviews.*, users.name as user_name 
         FROM reviews 
         LEFT JOIN users ON reviews.user_id = users.id 
         ORDER BY reviews.created_at DESC`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'خطأ في جلب التعليقات' });
            res.json(rows);
        }
    );
});

// المفضلة
app.post('/api/favorites', (req, res) => {
    const { user_id, hall_id } = req.body;
    db.run('INSERT OR IGNORE INTO favorites (user_id, hall_id) VALUES (?, ?)', [user_id, hall_id], function(err) {
        if (err) return res.json({ error: 'خطأ في الإضافة للمفضلة' });
        res.json({ success: true });
    });
});
app.delete('/api/favorites', (req, res) => {
    const { user_id, hall_id } = req.body;
    db.run('DELETE FROM favorites WHERE user_id = ? AND hall_id = ?', [user_id, hall_id], function(err) {
        if (err) return res.json({ error: 'خطأ في الحذف من المفضلة' });
        res.json({ success: true });
    });
});
app.get('/api/favorites/:user_id', (req, res) => {
    db.all('SELECT halls.* FROM favorites JOIN halls ON favorites.hall_id = halls.id WHERE favorites.user_id = ?', [req.params.user_id], (err, rows) => {
        // رجع الصور كمصفوفة
        rows.forEach(row => {
            if (row.images) {
                try { row.images = JSON.parse(row.images); } catch {}
            }
        });
        res.json(rows);
    });
});

// الحجوزات
function generateBookingNumber(callback) {
    function tryGenerate() {
        const num = '5' + Math.floor(100000 + Math.random() * 900000);
        db.get('SELECT 1 FROM bookings WHERE booking_number = ?', [num], (err, row) => {
            if (row) return tryGenerate();
            callback(num);
        });
    }
    tryGenerate();
}

app.post('/api/bookings', (req, res) => {
    const { user_id, hall_id, date, time, guests, notes, extras } = req.body;
    generateBookingNumber((booking_number) => {
        db.run(
            'INSERT INTO bookings (booking_number, user_id, hall_id, date, time, guests, notes, extras, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [booking_number, user_id, hall_id, date, time, guests, notes, extras || '', 'pending'],
            function(err) {
                if (err) return res.status(400).json({ error: err.message });
                res.json({ id: this.lastID, booking_number });
            }
        );
    });
});

app.get('/api/bookings/:user_id', (req, res) => {
    db.all(
        `SELECT bookings.*, halls.name, halls.location, halls.rating, halls.views 
         FROM bookings 
         JOIN halls ON bookings.hall_id = halls.id 
         WHERE bookings.user_id = ?`,
        [req.params.user_id],
        (err, rows) => {
            res.json(rows);
        }
    );
});

app.get('/api/bookings', (req, res) => {
    db.all(
        `SELECT bookings.*, halls.name, halls.location, halls.rating, halls.views 
         FROM bookings 
         JOIN halls ON bookings.hall_id = halls.id 
         ORDER BY bookings.id DESC`,
        [],
        (err, rows) => {
            res.json(rows);
        }
    );
});

app.post('/api/bookings/:id/status', (req, res) => {
    const { status } = req.body;
    db.run('UPDATE bookings SET status = ? WHERE id = ?', [status, req.params.id], function(err) {
        if (err) return res.json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

app.get('/api/booking/:booking_id', (req, res) => {
    db.get('SELECT bookings.*, halls.* FROM bookings JOIN halls ON bookings.hall_id = halls.id WHERE bookings.id = ?', [req.params.booking_id], (err, row) => {
        if (row && row.images) {
            try { row.images = JSON.parse(row.images); } catch {}
        }
        res.json(row);
    });
});

// رسائل الحجز
app.get('/api/messages/:booking_number', (req, res) => {
    db.all('SELECT * FROM messages WHERE booking_number = ? ORDER BY created_at ASC', [req.params.booking_number], (err, rows) => {
        res.json(rows);
    });
});
app.post('/api/messages', (req, res) => {
    const { booking_number, sender, message } = req.body;
    db.run('INSERT INTO messages (booking_number, sender, message) VALUES (?, ?, ?)', [booking_number, sender, message], function(err) {
        if (err) return res.json({ success: false, error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

// إشعارات القاعات المتاحة
app.post('/api/hall-available', (req, res) => {
    const { hall_id, date } = req.body;
    if (!hall_id || !date) return res.status(400).json({ success: false, error: 'بيانات ناقصة' });
    db.run(
        'INSERT INTO available_notifications (hall_id, date) VALUES (?, ?)',
        [hall_id, date],
        function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true });
        }
    );
});
app.get('/api/available-notifications', (req, res) => {
    db.all(
        `SELECT available_notifications.*, halls.name as hall_name 
         FROM available_notifications 
         LEFT JOIN halls ON available_notifications.hall_id = halls.id 
         ORDER BY available_notifications.created_at DESC`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'خطأ في جلب الإشعارات' });
            res.json(rows);
        }
    );
});

// مالك القاعة
app.post('/api/owner-register', (req, res) => {
    const { name, phone, password } = req.body;
    if (!name || !/^7\d{8}$/.test(phone) || !password) {
        return res.json({ success: false, error: 'بيانات غير صحيحة' });
    }
    db.get('SELECT * FROM owners WHERE phone = ?', [phone], (err, owner) => {
        if (owner) return res.json({ success: false, error: 'الحساب موجود بالفعل' });
        db.run('INSERT INTO owners (name, phone, password) VALUES (?, ?, ?)', [name, phone, password], function(err) {
            if (err) return res.json({ success: false, error: err.message });
            db.get('SELECT id, name, phone FROM owners WHERE id = ?', [this.lastID], (err, newOwner) => {
                res.json({ success: true, owner: newOwner });
            });
        });
    });
});
app.post('/api/owner-login', (req, res) => {
    const { phone, password } = req.body;
    db.get('SELECT * FROM owners WHERE phone = ?', [phone], (err, owner) => {
        if (!owner) return res.json({ success: false, error: 'الرقم غير موجود' });
        if (owner.password !== password) return res.json({ success: false, error: 'كلمة المرور غير صحيحة' });
        res.json({ success: true, owner });
    });
});

// المحفظة
app.get('/api/wallet/:user_id', (req, res) => {
    const user_id = req.params.user_id;
    db.get('SELECT wallet_balance, wallet_bonus_expiry FROM users WHERE id = ?', [user_id], (err, user) => {
        if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
        db.all('SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC', [user_id], (err, transactions) => {
            res.json({
                balance: user.wallet_balance,
                bonus_expiry: user.wallet_bonus_expiry,
                transactions
            });
        });
    });
});
app.post('/api/wallet/add', (req, res) => {
    const { user_id, amount, description, action } = req.body;
    if (!user_id || !amount) return res.json({ success: false, error: 'بيانات ناقصة' });
    db.get('SELECT wallet_balance FROM users WHERE id = ?', [user_id], (err, user) => {
        if (!user) return res.json({ success: false, error: 'المستخدم غير موجود' });
        let newBalance;
        let realAmount = parseInt(amount);
        let type = 'admin_add';
        if (action === 'deduct') {
            if (user.wallet_balance < realAmount) return res.json({ success: false, error: 'الرصيد غير كافٍ' });
            newBalance = user.wallet_balance - realAmount;
            realAmount = -realAmount;
            type = 'admin_deduct';
        } else {
            newBalance = user.wallet_balance + realAmount;
        }
        db.run('UPDATE users SET wallet_balance = ? WHERE id = ?', [newBalance, user_id], function(err) {
            if (err) return res.json({ success: false, error: err.message });
            db.run(
                'INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
                [user_id, realAmount, type, description || (action === 'deduct' ? 'خصم من الإدارة' : 'شحن من الإدارة')],
                function(err2) {
                    if (err2) return res.json({ success: false, error: err2.message });
                    res.json({ success: true, newBalance });
                }
            );
        });
    });
});

// ملفات الواجهة
app.use(express.static(path.join(__dirname, '../frontend')));
app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/api/hall-images/:folder', (req, res) => {
    const folder = req.params.folder;
    const dirPath = path.join(__dirname, '../frontend/image/', folder);
    fs.readdir(dirPath, (err, files) => {
        if (err) return res.json([]);
        // رجع فقط الصور
        const images = files.filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f))
            .map(f => `image/${folder}/${f}`);
        res.json(images);
    });
});

app.post('/api/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) return res.json({ error: 'لم يتم رفع صورة' });
    res.json({ url: `image/uploads/${req.file.filename}` });
});

app.listen(3001, () => console.log('Server running on http://localhost:3001'));