console.log("HAMID JS LOADED");
const troops = {

    zanjir: {
        name: "زنجیرشکن",
        icon: "👹🛡️",
        wheat: 321,
        wood: 391,
        stone: 500,
        iron: 149,
        time: 1.45,
        power: 92.85
    },

    jaloot: {
        name: "جالوت",
        icon: "👹🛡️",
        wheat: 539,
        wood: 291,
        stone: 148,
        iron: 57,
        time: 1.15,
        power: 73.75
    },

    dastderaz: {
        name: "دست‌دراز غول",
        icon: "👑🛡️",
        wheat: 199,
        wood: 91,
        stone: 128,
        iron: 349,
        time: 1.38,
        power: 68.45
    },

    gladiator: {
        name: "گلادیاتور",
        icon: "⚔️🏛️",
        wheat: 235,
        wood: 322,
        stone: 337,
        iron: 349,
        time: 1.42,
        power: 94.35
    },

    gard: {
        name: "گارد سلطنتی",
        icon: "👑🛡️",
        wheat: 240,
        wood: 244,
        stone: 288,
        iron: 439,
        time: 1.15,
        power: 84.2
    },

    shekanshamsher: {
        name: "شمشیرشکن",
        icon: "⚔️🛡️",
        wheat: 203,
        wood: 357,
        stone: 384,
        iron: 258,
        time: 0.50,
        power: 83.85
    },

    negahban: {
        name: "نگهبان",
        icon: "🛡️🏰",
        wheat: 221,
        wood: 210,
        stone: 290,
        iron: 403,
        time: 0.50,
        power: 77.5
    },

    doshamsher: {
        name: "دوشمشیره",
        icon: "⚔️⚔️",
        wheat: 149,
        wood: 148,
        stone: 206,
        iron: 244,
        time: 0.58,
        power: 52.95
    },

    modafe: {
        name: "مدافع",
        icon: "🛡️⚔️",
        wheat: 111,
        wood: 140,
        stone: 151,
        iron: 199,
        time: 0.39,
        power: 52.95
    },

    jonongar: {
        name: "جنونگر",
        icon: "😈⚔️",
        wheat: 102,
        wood: 119,
        stone: 131,
        iron: 154,
        time: 0.42,
        power: 47.35
    },

    shovaliye: {
        name: "شوالیه",
        icon: "🛡️🐎",
        wheat: 64,
        wood: 98,
        stone: 103,
        iron: 159,
        time: 0.53,
        power: 42.1
    },

    shamsherzan: {
        name: "شمشیرزن",
        icon: "⚔️🗡️",
        wheat: 61,
        wood: 85,
        stone: 77,
        iron: 117,
        time: 0.45,
        power: 35.1
    },

    javidan: {
        name: "جاویدان",
        icon: "👑🛡️",
        wheat: 398,
        wood: 392,
        stone: 304,
        iron: 500,
        time: 1.40,
        power: 95.3
    },

    hoplite: {
        name: "هوپلیت",
        icon: "🛡️🗡️",
        wheat: 209,
        wood: 301,
        stone: 234,
        iron: 367,
        time: 1.13,
        power: 84.2
    },

    tirandaz: {
        name: "تیرانداز",
        icon: "🏹🎯",
        wheat: 104,
        wood: 164,
        stone: 147,
        iron: 83,
        time: 0.46,
        power: 46.35
    },

    zobin: {
        name: "زوبین‌زن",
        icon: "🏹🗡️",
        wheat: 114,
        wood: 181,
        stone: 166,
        iron: 111,
        time: 0.39,
        power: 60.85
    },

    shekarchi: {
        name: "شکارچی",
        icon: "🏹",
        wheat: 171,
        wood: 229,
        stone: 204,
        iron: 151,
        time: 0.52,
        power: 60.85
    },

    tiratashin: {
        name: "تیرآتشین",
        icon: "🔥🏹",
        wheat: 216,
        wood: 321,
        stone: 265,
        iron: 239,
        time: 0.59,
        power: 76.5
    },

    oghab: {
        name: "عقاب",
        icon: "🦅⚔️",
        wheat: 253,
        wood: 377,
        stone: 307,
        iron: 257,
        time: 1.13,
        power: 81.65
    },

    yakhzad: {
        name: "یخزاد",
        icon: "❄️⚔️",
        wheat: 187,
        wood: 307,
        stone: 459,
        iron: 333,
        time: 1.23,
        power: 88.2
    },

    nokhbe: {
        name: "نخبه",
        icon: "👑⚔️",
        wheat: 255,
        wood: 460,
        stone: 249,
        iron: 325,
        time: 1.30,
        power: 91.95
    },


    // =========================
    // سواره نظام
    // =========================

    savarkar: {
        name: "سوارکار",
        icon: "🏇",
        wheat: 101,
        wood: 52,
        stone: 99,
        iron: 76,
        time: 0.50,
        power: 29.2
    },

    savarkarSepardar: {
        name: "سوارکار سپردار",
        icon: "🏇🛡️",
        wheat: 199,
        wood: 131,
        stone: 123,
        iron: 107,
        time: 0.53,
        power: 10.5
    },

    barkesh: {
        name: "بارکش",
        icon: "🏇🗡️",
        wheat: 290,
        wood: 328,
        stone: 189,
        iron: 148,
        time: 1.13,
        power: 29.6
    },

    savarnize: {
        name: "سوارنیزه",
        icon: "🏇🗡️",
        wheat: 169,
        wood: 83,
        stone: 106,
        iron: 89,
        time: 0.58,
        power: 39.7
    },

    saye: {
        name: "سایه‌سوار",
        icon: "🗡️",
        wheat: 582,
        wood: 347,
        stone: 221,
        iron: 361,
        time: 1.21,
        power: 88.4
    },

    zerehi: {
        name: "سوار نظام زرهی",
        icon: "🐎",
        wheat: 521,
        wood: 333,
        stone: 249,
        iron: 552,
        time: 1.57,
        power: 98.2
    },


    // =========================
    // جنگی
    // =========================

    tabarzindar: {
        name: "تبرزیندار",
        icon: "🪓🛡️",
        wheat: 174,
        wood: 228,
        stone: 257,
        iron: 283,
        time: 1.05,
        power: 75.65
    },

    nizeboland: {
        name: "نیزه بلند",
        icon: "🗡️🏹",
        wheat: 92,
        wood: 106,
        stone: 221,
        iron: 258,
        time: 0.34,
        power: 65.9
    },

    nizebortab: {
        name: "نیزه برتاب",
        icon: "🗡️🏹",
        wheat: 106,
        wood: 173,
        stone: 121,
        iron: 166,
        time: 1.07,
        power: 57.7
    },

    divar: {
        name: "دیوار دفاعی",
        icon: "🧱🛡️",
        wheat: 100,
        wood: 123,
        stone: 128,
        iron: 149,
        time: 0.49,
        power: 55.25
    },

    nizeandaz: {
        name: "نیزه‌انداز",
        icon: "🗡️🏹",
        wheat: 63,
        wood: 89,
        stone: 146,
        iron: 133,
        time: 0.41,
        power: 47
    },


    // =========================
    // کمانداران
    // =========================

    kamandar: {
        name: "کماندار",
        icon: "🏹🎯",
        wheat: 58,
        wood: 116,
        stone: 84,
        iron: 56,
        time: 0.42,
        power: 33.95
    },

    zahreban: {
        name: "زهربان",
        icon: "🏹🎯",
        wheat: 91,
        wood: 137,
        stone: 94,
        iron: 8,
        time: 1.10,
        power: 45.55
    },


    // =========================
    // وسایل جنگی
    // =========================

    gari: {
        name: "گاری",
        icon: "🛒",
        wheat: 589,
        wood: 633,
        stone: 257,
        iron: 212,
        time: 0.57,
        power: 53.65
    },

    arabe: {
        name: "ارابه‌ران",
        icon: "🏹🛞",
        wheat: 120,
        wood: 100,
        stone: 150,
        iron: 80,
        time: 0.25,
        power: 55.1
    },


    // =========================
    // حیوانات
    // =========================

    sag: {
        name: "سگ شکاری",
        icon: "🐕",
        wheat: 176,
        wood: 133,
        stone: 177,
        iron: 33,
        time: 0.50,
        power: 51.5
    },

    kargin: {
        name: "کارگین",
        icon: "🦾",
        wheat: 188,
        wood: 99,
        stone: 221,
        iron: 219,
        time: 0.44,
        power: 51.5
    },

    gav: {
        name: "گاومیش",
        icon: "🦬",
        wheat: 91,
        wood: 91,
        stone: 321,
        iron: 262,
        time: 1.30,
        power: 59.35
    },

    fil: {
        name: "فیل",
        icon: "🐘",
        wheat: 203,
        wood: 203,
        stone: 446,
        iron: 234,
        time: 1.30,
        power: 76.65
    },

    kargadan: {
        name: "کرگدن",
        icon: "🦏",
        wheat: 343,
        wood: 306,
        stone: 446,
        iron: 303,
        time: 1.13,
        power: 89.4
    },

    khers: {
        name: "خرس",
        icon: "🐻",
        wheat: 468,
        wood: 439,
        stone: 321,
        iron: 368,
        time: 1.19,
        power: 95.65
    },


    // =========================
    // کولی
    // =========================

    kuli: {
        name: "کولی",
        icon: "🦍",
        wheat: 111,
        wood: 147,
        stone: 232,
        iron: 277,
        time: 0.47,
        power: 62
    },

    Shirdel: {
        name: "شیردل",
        icon: "🦁",
        wheat: 368,
        wood: 384,
        stone: 186,
        iron: 209,
        time: 1.05,
        power: 74.55
    },

    mogul: {
        name: "مغول",
        icon: "👑",
        wheat: 354,
        wood: 409,
        stone: 216,
        iron: 239,
        time: 1.21,
        power: 83.65
    },

    aztak: {
        name: "آتزاك",
        icon: "🦖",
        wheat: 90,
        wood: 469,
        stone: 432,
        iron: 184,
        time: 1.45,
        power: 93
    },

    barbar: {
        name: "بربر",
        icon: "🪓",
        wheat: 303,
        wood: 472,
        stone: 157,
        iron: 239,
        time: 1.37,
        power: 88.9
    }

};


// =========================
// Screenshot
// =========================

function takeScreenshot() {

    let result = document.getElementById("result");

    html2canvas(result).then(canvas => {

        let link = document.createElement("a");

        link.download = "Empire-Result.png";

        link.href = canvas.toDataURL();

        link.click();

    });

}


// =========================
// Calculate
// =========================

function calculate() {

    let type = document.getElementById("troop").value;

    let count = Number(
        document.getElementById("count").value
    );

    let troop = troops[type];

    let result = document.getElementById("result");


    if (!troop) {

        result.innerHTML = "❌ این نیرو پیدا نشد";

        return;

    }


    if (count <= 0 || !Number.isFinite(count)) {

        result.innerHTML =
            "❌ لطفاً تعداد درست وارد کنید";

        return;

    }


    let wheat = troop.wheat * count;

    let wood = troop.wood * count;

    let stone = troop.stone * count;

    let iron = troop.iron * count;


    let time = toMinutes(troop.time) * count;

    let power = Math.floor(
        troop.power * count
    );


    let gold = Math.round(
        time * (350 / 60)
    );


    result.innerHTML = `

        <h2>
            ${troop.icon}
            ${count}
            ${troop.name}
        </h2>

        <p>⚔️ قدرت: ${power}</p>

        <p>🌾 گندم: ${wheat}</p>

        <p>🪵 چوب: ${wood}</p>

        <p>🪨 سنگ: ${stone}</p>

        <p>⛏️ آهن: ${iron}</p>

        <p>
            ⏱️ زمان:
            ${formatTime(time)}
        </p>

        <p>
            🪙 معادل طلای کل آیتم‌ها:
            ${gold}
        </p>

    `;
}


// =========================
// Convert game time
// Example: 1.30 = 1 minute 30 seconds
// =========================

function toMinutes(time) {

    const minutes = Math.floor(time);

    const seconds = Math.round(
        (time - minutes) * 100
    );

    return minutes + seconds / 60;
}


// =========================
// Format time
// =========================

function formatTime(totalMinutes) {

    let minutes = Math.floor(totalMinutes);

    let seconds = Math.round(
        (totalMinutes - minutes) * 60
    );


    if (seconds >= 60) {

        minutes++;

        seconds = 0;

    }


    return `${minutes} دقیقه و ${seconds} ثانیه`;

}

