/** Privacy Policy and Terms of Use, in English and Bahasa Melayu — the PDPA 2010 notice has to be
 *  given in both. Keep the two languages in step when editing. */

/** Who runs Redline and how to reach them — shown publicly on both pages. */
export const OPERATOR = {
  name: 'Ahmad Azri',
  email: 'ahmdazri65@gmail.com',
};

export const LEGAL_UPDATED = '2026-10-03';

export type LegalLang = 'en' | 'ms';
export type LegalDoc = 'privacy' | 'terms';
export type LegalSection = { heading: string; body: string[]; list?: string[] };
type LegalText = { title: string; intro: string; updated: string; sections: LegalSection[] };

const op = OPERATOR.name;
const mail = OPERATOR.email;

export const LEGAL: Record<LegalDoc, Record<LegalLang, LegalText>> = {
  privacy: {
    en: {
      title: 'Privacy Policy',
      updated: 'Last updated',
      intro: `Redline is run by ${op} ("we", "us"). This notice explains what personal data Redline collects, why, and the choices you have, as required by Malaysia's Personal Data Protection Act 2010 (PDPA).`,
      sections: [
        {
          heading: '1. Data we collect about you',
          body: ['When you create and use an account, we store:'],
          list: [
            'Account details: your name, email address, phone number, primary brand and password (stored only as a secure hash, never in plain text).',
            'Profile details you choose to add: photo, role, bio, showroom name and address, and social media links.',
            'Your work in the app: price settings, quote preferences, sales targets, bankers you save, and notes.',
            'Technical data needed to keep you signed in and secure: a session cookie, and sign-in attempts used to block password guessing.',
          ],
        },
        {
          heading: '2. Data about your customers',
          body: [
            'Customer Manager lets you record your own customers: names, phone numbers, lead source, the car and quotation, and whether the deal is won or lost (with optional notes). Redline does not collect IC numbers, addresses, email, driving licence numbers, car registration, chassis or engine numbers, or bank loan approval details. You enter this data, and you decide what to record.',
            'For this data, you are responsible for having your customers’ consent and for using it only for the sale you are handling. We store and process it only to provide Redline to you, and never use it for anything else.',
          ],
        },
        {
          heading: '3. Why we use it',
          body: ['We use personal data only to:'],
          list: [
            'provide Redline: sign-in, saving your work, calculating quotes and generating posters;',
            'show your public profile on the quote links you choose to share;',
            'keep the service secure and prevent abuse;',
            'respond when you contact us.',
          ],
        },
        {
          heading: '4. What customers see on your quote link',
          body: [
            'When you share a quote link, anyone who opens it can see your name, role, phone number, photo, bio, showroom and social links, plus your quote settings and prices. They never see your email, your customers or any other account data. Link previews (for example on WhatsApp) show your name, role, showroom and photo.',
          ],
        },
        {
          heading: '5. Who we share it with',
          body: [
            'We do not sell or rent personal data, and we do not share it for advertising. Redline is hosted on Cloudflare, whose servers store and deliver the data on our behalf and may be located outside Malaysia. Otherwise we disclose data only if required by law.',
          ],
        },
        {
          heading: '6. Cookies and local storage',
          body: [
            'We use one essential cookie to keep you signed in. Your browser also stores a few preferences on your device, such as dismissed tips. We do not use advertising or tracking cookies.',
          ],
        },
        {
          heading: '7. How long we keep it',
          body: [
            'We keep your data while your account is open. When you delete your account in Settings, your profile, settings, customers, bankers and pricing changes are deleted straight away.',
          ],
        },
        {
          heading: '8. Security',
          body: [
            'Data is sent over encrypted connections (HTTPS), passwords are hashed, and each account can only access its own data. No system is completely secure, so please use a strong password that you do not use anywhere else.',
          ],
        },
        {
          heading: '9. Your rights',
          body: ['Under the PDPA you may:'],
          list: [
            'access your data: use Settings → Export all data at any time;',
            'correct your data: edit it directly in the app;',
            'withdraw consent and have your data deleted: use Settings → Delete account;',
            'ask us anything about your data, or make a request, using the contact details below.',
          ],
        },
        {
          heading: '10. Is providing data required?',
          body: [
            'Your name, email, phone number, primary brand and password are needed to create an account. Everything else is optional, but some features will not work without it; for example, quote links cannot show your photo if you have not added one.',
          ],
        },
        {
          heading: '11. Changes to this notice',
          body: ['If we change this notice, we will update the date at the top and, for significant changes, tell you in the app.'],
        },
        {
          heading: '12. Contact',
          body: [`For questions, access or correction requests, or complaints about your personal data, contact ${op} at ${mail}.`],
        },
      ],
    },
    ms: {
      title: 'Dasar Privasi',
      updated: 'Kemas kini terakhir',
      intro: `Redline dikendalikan oleh ${op} ("kami"). Notis ini menerangkan data peribadi yang dikumpul oleh Redline, sebab ia dikumpul dan pilihan yang anda ada, seperti yang dikehendaki oleh Akta Perlindungan Data Peribadi 2010 (PDPA).`,
      sections: [
        {
          heading: '1. Data yang kami kumpul tentang anda',
          body: ['Apabila anda membuka dan menggunakan akaun, kami menyimpan:'],
          list: [
            'Butiran akaun: nama, alamat e-mel, nombor telefon, jenama utama dan kata laluan anda (disimpan sebagai hash yang selamat sahaja, tidak sekali-kali dalam teks biasa).',
            'Butiran profil yang anda pilih untuk tambah: foto, jawatan, bio, nama dan alamat bilik pameran, serta pautan media sosial.',
            'Kerja anda dalam aplikasi: tetapan harga, pilihan sebut harga, sasaran jualan, pegawai bank yang anda simpan dan nota.',
            'Data teknikal yang diperlukan untuk memastikan anda kekal log masuk dan selamat: kuki sesi, dan cubaan log masuk yang digunakan untuk menyekat tekaan kata laluan.',
          ],
        },
        {
          heading: '2. Data tentang pelanggan anda',
          body: [
            'Pengurus Pelanggan membolehkan anda merekod pelanggan anda sendiri: nama, nombor telefon, sumber prospek, kereta dan sebut harga, serta sama ada urusan berjaya atau gagal (dengan nota pilihan). Redline tidak mengumpul nombor IC, alamat, e-mel, nombor lesen memandu, nombor pendaftaran, casis atau enjin kereta, atau butiran kelulusan pinjaman bank. Anda yang memasukkan data ini, dan anda yang menentukan apa yang direkod.',
            'Bagi data ini, anda bertanggungjawab untuk mendapatkan persetujuan pelanggan anda dan menggunakannya hanya untuk jualan yang anda uruskan. Kami menyimpan dan memprosesnya hanya untuk menyediakan Redline kepada anda, dan tidak sekali-kali menggunakannya untuk tujuan lain.',
          ],
        },
        {
          heading: '3. Tujuan kami menggunakannya',
          body: ['Kami menggunakan data peribadi hanya untuk:'],
          list: [
            'menyediakan Redline: log masuk, menyimpan kerja anda, mengira sebut harga dan menjana poster;',
            'memaparkan profil awam anda pada pautan sebut harga yang anda pilih untuk kongsi;',
            'memastikan perkhidmatan selamat dan mencegah penyalahgunaan;',
            'membalas apabila anda menghubungi kami.',
          ],
        },
        {
          heading: '4. Apa yang pelanggan lihat pada pautan sebut harga anda',
          body: [
            'Apabila anda berkongsi pautan sebut harga, sesiapa yang membukanya boleh melihat nama, jawatan, nombor telefon, foto, bio, bilik pameran dan pautan sosial anda, serta tetapan sebut harga dan harga anda. Mereka tidak sekali-kali melihat e-mel anda, pelanggan anda atau data akaun lain. Pratonton pautan (contohnya di WhatsApp) memaparkan nama, jawatan, bilik pameran dan foto anda.',
          ],
        },
        {
          heading: '5. Dengan siapa kami berkongsi',
          body: [
            'Kami tidak menjual atau menyewakan data peribadi, dan tidak berkongsinya untuk pengiklanan. Redline dihoskan di Cloudflare, yang pelayannya menyimpan dan menghantar data bagi pihak kami dan mungkin terletak di luar Malaysia. Selain itu, kami hanya mendedahkan data jika dikehendaki oleh undang-undang.',
          ],
        },
        {
          heading: '6. Kuki dan storan setempat',
          body: [
            'Kami menggunakan satu kuki penting untuk memastikan anda kekal log masuk. Pelayar anda juga menyimpan beberapa pilihan pada peranti anda, seperti tip yang telah ditutup. Kami tidak menggunakan kuki pengiklanan atau penjejakan.',
          ],
        },
        {
          heading: '7. Berapa lama kami menyimpannya',
          body: [
            'Kami menyimpan data anda selagi akaun anda dibuka. Apabila anda memadam akaun dalam Tetapan, profil, tetapan, pelanggan, pegawai bank dan perubahan harga anda dipadam serta-merta.',
          ],
        },
        {
          heading: '8. Keselamatan',
          body: [
            'Data dihantar melalui sambungan yang disulitkan (HTTPS), kata laluan disimpan sebagai hash, dan setiap akaun hanya boleh mengakses datanya sendiri. Tiada sistem yang selamat sepenuhnya, jadi sila gunakan kata laluan yang kukuh dan tidak digunakan di tempat lain.',
          ],
        },
        {
          heading: '9. Hak anda',
          body: ['Di bawah PDPA, anda boleh:'],
          list: [
            'mengakses data anda: gunakan Tetapan → Eksport semua data pada bila-bila masa;',
            'membetulkan data anda: sunting terus dalam aplikasi;',
            'menarik balik persetujuan dan memadam data anda: gunakan Tetapan → Padam akaun;',
            'bertanya apa-apa tentang data anda, atau membuat permintaan, melalui butiran hubungan di bawah.',
          ],
        },
        {
          heading: '10. Adakah data wajib diberikan?',
          body: [
            'Nama, e-mel, nombor telefon, jenama utama dan kata laluan anda diperlukan untuk membuka akaun. Yang lain adalah pilihan, tetapi sesetengah ciri tidak akan berfungsi tanpanya; contohnya, pautan sebut harga tidak dapat memaparkan foto anda jika anda belum menambahnya.',
          ],
        },
        {
          heading: '11. Perubahan pada notis ini',
          body: ['Jika kami mengubah notis ini, kami akan mengemas kini tarikh di atas dan, bagi perubahan yang ketara, memaklumkan anda dalam aplikasi.'],
        },
        {
          heading: '12. Hubungi',
          body: [`Untuk pertanyaan, permintaan akses atau pembetulan, atau aduan tentang data peribadi anda, hubungi ${op} di ${mail}.`],
        },
      ],
    },
  },
  terms: {
    en: {
      title: 'Terms of Use',
      updated: 'Last updated',
      intro: `These terms apply when you use Redline, run by ${op}. By creating an account you agree to them. If you do not agree, please do not use Redline.`,
      sections: [
        {
          heading: '1. The service',
          body: [
            'Redline is a tool for car sales consultants to price cars, prepare quotes and posters, share quote links, and track their own customers and deals. Redline is still in development: features may change, and there may be occasional interruptions or errors.',
          ],
        },
        {
          heading: '2. Quotes are estimates',
          body: [
            'Prices, rebates, loan amounts, interest rates, insurance and monthly instalments shown in Redline, on posters and on quote links are estimates only. They are not an offer, a loan approval or a binding price. Always confirm the final figures with the dealership, the bank and the insurer before a customer commits.',
          ],
        },
        {
          heading: '3. Your account',
          body: [
            'Give accurate details, keep your password to yourself, and tell us if you think someone else has accessed your account. You are responsible for what happens under your account.',
          ],
        },
        {
          heading: '4. Your customers’ data',
          body: [
            'You own the data you enter. When you record customers’ personal data, you must have their consent, use it only for their purchase, and follow the Personal Data Protection Act 2010. Do not record data you do not need, and do not enter IC, registration, chassis or engine numbers in notes.',
          ],
        },
        {
          heading: '5. Acceptable use',
          body: ['You must not:'],
          list: [
            'use Redline for anything unlawful, misleading or fraudulent;',
            'publish false prices or impersonate another person, dealership or brand;',
            'try to access other users’ data, disrupt the service, or probe it for weaknesses without our permission;',
            'resell or copy the service.',
          ],
        },
        {
          heading: '6. Brands and content',
          body: [
            'Car brand names, logos, images and brochures belong to their respective owners and are shown to help you sell their vehicles. You are responsible for the photos, text and links you add.',
          ],
        },
        {
          heading: '7. Liability',
          body: [
            'Redline is provided "as is". To the extent the law allows, we are not liable for any loss arising from using Redline, including losses caused by incorrect figures, lost deals or unavailable service. Nothing in these terms limits rights you have that cannot be excluded under Malaysian law.',
          ],
        },
        {
          heading: '8. Ending your use',
          body: [
            'You can stop at any time and delete your account in Settings. We may suspend or close accounts that break these terms.',
          ],
        },
        {
          heading: '9. Changes',
          body: ['We may update these terms. If the changes are significant, we will tell you in the app, and continuing to use Redline means you accept them.'],
        },
        {
          heading: '10. Governing law and contact',
          body: [`These terms are governed by the laws of Malaysia. Questions? Contact ${op} at ${mail}.`],
        },
      ],
    },
    ms: {
      title: 'Terma Penggunaan',
      updated: 'Kemas kini terakhir',
      intro: `Terma ini terpakai apabila anda menggunakan Redline, yang dikendalikan oleh ${op}. Dengan membuka akaun, anda bersetuju dengannya. Jika anda tidak bersetuju, sila jangan gunakan Redline.`,
      sections: [
        {
          heading: '1. Perkhidmatan',
          body: [
            'Redline ialah alat untuk perunding jualan kereta menetapkan harga kereta, menyediakan sebut harga dan poster, berkongsi pautan sebut harga, serta menjejak pelanggan dan urus niaga mereka sendiri. Redline masih dalam pembangunan: ciri mungkin berubah, dan mungkin ada gangguan atau ralat sekali-sekala.',
          ],
        },
        {
          heading: '2. Sebut harga ialah anggaran',
          body: [
            'Harga, rebat, jumlah pinjaman, kadar faedah, insurans dan ansuran bulanan yang dipaparkan dalam Redline, pada poster dan pada pautan sebut harga adalah anggaran sahaja. Ia bukan tawaran, kelulusan pinjaman atau harga yang mengikat. Sentiasa sahkan angka akhir dengan pengedar, bank dan syarikat insurans sebelum pelanggan membuat keputusan.',
          ],
        },
        {
          heading: '3. Akaun anda',
          body: [
            'Berikan butiran yang tepat, rahsiakan kata laluan anda, dan maklumkan kami jika anda rasa orang lain telah mengakses akaun anda. Anda bertanggungjawab atas apa yang berlaku di bawah akaun anda.',
          ],
        },
        {
          heading: '4. Data pelanggan anda',
          body: [
            'Anda memiliki data yang anda masukkan. Apabila anda merekod data peribadi pelanggan, anda mesti mendapatkan persetujuan mereka, menggunakannya hanya untuk pembelian mereka, dan mematuhi Akta Perlindungan Data Peribadi 2010. Jangan rekod data yang tidak diperlukan, dan jangan masukkan nombor IC, pendaftaran, casis atau enjin dalam nota.',
          ],
        },
        {
          heading: '5. Penggunaan yang dibenarkan',
          body: ['Anda tidak boleh:'],
          list: [
            'menggunakan Redline untuk apa-apa yang menyalahi undang-undang, mengelirukan atau menipu;',
            'menyiarkan harga palsu atau menyamar sebagai orang, pengedar atau jenama lain;',
            'cuba mengakses data pengguna lain, mengganggu perkhidmatan, atau menguji kelemahannya tanpa kebenaran kami;',
            'menjual semula atau meniru perkhidmatan ini.',
          ],
        },
        {
          heading: '6. Jenama dan kandungan',
          body: [
            'Nama jenama, logo, imej dan brosur kereta adalah milik pemilik masing-masing dan dipaparkan untuk membantu anda menjual kenderaan mereka. Anda bertanggungjawab atas foto, teks dan pautan yang anda tambah.',
          ],
        },
        {
          heading: '7. Liabiliti',
          body: [
            'Redline disediakan "seadanya". Setakat yang dibenarkan oleh undang-undang, kami tidak bertanggungjawab atas sebarang kerugian akibat penggunaan Redline, termasuk kerugian akibat angka yang salah, urus niaga yang terlepas atau perkhidmatan yang tidak tersedia. Tiada apa-apa dalam terma ini yang mengehadkan hak anda yang tidak boleh dikecualikan di bawah undang-undang Malaysia.',
          ],
        },
        {
          heading: '8. Menamatkan penggunaan',
          body: ['Anda boleh berhenti pada bila-bila masa dan memadam akaun anda dalam Tetapan. Kami boleh menggantung atau menutup akaun yang melanggar terma ini.'],
        },
        {
          heading: '9. Perubahan',
          body: ['Kami mungkin mengemas kini terma ini. Jika perubahannya ketara, kami akan memaklumkan anda dalam aplikasi, dan meneruskan penggunaan Redline bermakna anda menerimanya.'],
        },
        {
          heading: '10. Undang-undang dan hubungan',
          body: [`Terma ini ditadbir oleh undang-undang Malaysia. Ada soalan? Hubungi ${op} di ${mail}.`],
        },
      ],
    },
  },
};
