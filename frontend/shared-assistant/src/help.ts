import { newId, sanitizeContext, isAllowedAction, type AssistantAction, type AssistantReply, type Language, type SafeContext } from './contracts.ts';
export const SOURCE_LINKS: Record<string, { title: string; path: string }> = {
  overview: { title: 'About AegisOne', path: '/docs#assistant-overview' },
  features: { title: 'Product capabilities', path: '/docs#assistant-features' },
  pricing: { title: 'Plans and prices', path: '/docs#assistant-pricing' },
  deployment: { title: 'Deployment guide', path: '/docs#assistant-deployment' },
  'setup-organization': { title: 'Organization setup', path: '/docs#assistant-organization' },
  'setup-structure': { title: 'Employee import', path: '/docs#assistant-structure' },
  'setup-validation': { title: 'Validation help', path: '/docs#assistant-validation' },
  'setup-security': { title: 'SMTP setup', path: '/docs#assistant-security' },
  'setup-rollout': { title: 'Rollout help', path: '/docs#assistant-rollout' },
  privacy: { title: 'Assistant privacy', path: '/docs#assistant-privacy' },
  limitations: { title: 'Limitations', path: '/docs#assistant-limitations' },
  contact: { title: 'Contact the team', path: '/#contact' },
};
export const STARTER_PROMPTS: Record<Language, string[]> = {
  en: ['Explain AegisOne', 'Which plan fits my team?', 'How does installation work?'],
  ur: ['ایجس ون کیا ہے؟', 'میری ٹیم کے لیے کون سا پلان مناسب ہے؟', 'انسٹالیشن کیسے ہوتی ہے؟'],
  'ur-Latn': ['AegisOne kya hai?', 'Meri team ke liye konsa plan theek hai?', 'Installation kaise hoti hai?'],
};
type LocalCopy = Record<Language, string>;
const HELP = {
  overview: {
    en: 'AegisOne helps organizations detect phishing in URLs, text, emails, images and supported documents. It combines a browser extension, specialized detection models, and dashboards for employees and administrators. Detection can make mistakes, so review suspicious results. Ask me about plans, deployment, or the setup step you are on.',
    ur: 'ایجس ون اداروں کو لنکس، متن، ای میل، تصاویر اور معاون دستاویزات میں فشنگ کی شناخت میں مدد دیتا ہے۔ اس میں براؤزر ایکسٹینشن، مخصوص شناختی ماڈلز اور ملازمین و منتظمین کے ڈیش بورڈ شامل ہیں۔ شناخت میں غلطی ممکن ہے، اس لیے مشکوک نتائج کا جائزہ لیں۔ آپ پلان، انسٹالیشن یا موجودہ سیٹ اپ مرحلے کے بارے میں پوچھ سکتے ہیں۔',
    'ur-Latn': 'AegisOne links, text, emails, images aur supported documents mein phishing pehchanne mein madad karta hai. Is mein browser extension, detection models aur employee/admin dashboards hain. Detection mein ghalti mumkin hai; suspicious results review karein. Plans, installation ya current setup step ke bare mein pooch sakte hain.',
  },
  features: {
    en: 'AegisOne combines URL, text, email, image and supported attachment analysis with a browser extension and role-based dashboards. Employees can review detections and reports; managers and administrators review team activity and incidents. It also explains why content was flagged. Available protection depends on installation and configuration, and detection can make mistakes.',
    ur: 'AegisOne لنکس، متن، ای میل، تصاویر اور معاون منسلک فائلوں کا تجزیہ کرتا ہے۔ اس میں براؤزر ایکسٹینشن اور مختلف کرداروں کے لیے ڈیش بورڈ شامل ہیں۔ ملازمین نتائج اور رپورٹس دیکھتے ہیں، جبکہ منتظمین ٹیم کی سرگرمی اور واقعات کا جائزہ لیتے ہیں۔ یہ مشکوک مواد کی وجہ بھی سمجھاتا ہے۔ دستیاب حفاظت تنصیب اور ترتیب پر منحصر ہے اور شناخت میں غلطی ممکن ہے۔',
    'ur-Latn': 'AegisOne links, text, emails, images aur supported attachments analyze karta hai. Browser extension aur role-based dashboards bhi hain. Employees results aur reports dekhte hain; managers aur admins team activity aur incidents review karte hain. Flag honay ki wajah bhi samjhata hai. Protection installation aur configuration par depend karti hai, aur detection mein ghalti mumkin hai.',
  },
  purpose: {
    en: 'I’m the AegisOne product assistant. I’m here to explain phishing protection, compare plans, and guide you through installation and organization setup. I can answer product questions, but I cannot run commands, change your account, or guarantee that a link is safe.',
    ur: 'میں AegisOne کا پروڈکٹ معاون ہوں۔ میں فشنگ سے حفاظت، پلان اور انسٹالیشن سمجھانے اور ادارے کے سیٹ اپ میں رہنمائی کے لیے یہاں ہوں۔ میں پروڈکٹ کے سوالوں کا جواب دے سکتا ہوں، لیکن کمانڈ نہیں چلا سکتا، آپ کا اکاؤنٹ تبدیل نہیں کر سکتا اور کسی لنک کے محفوظ ہونے کی ضمانت نہیں دے سکتا۔',
    'ur-Latn': 'Main AegisOne ka product assistant hoon. Main phishing protection aur plans samjhane, installation aur organization setup mein rehnumai ke liye yahan hoon. Product ke sawalon ka jawab de sakta hoon, lekin commands nahi chala sakta, account change nahi kar sakta aur kisi link ke safe hone ki guarantee nahi de sakta.',
  },
  safety: {
    en: 'AegisOne helps detect phishing, but it cannot guarantee complete safety. Detection can miss threats or flag legitimate content, and protection depends on installation and configuration. Protect administrator credentials, review suspicious results, and ask your IT team to review the deployment. This guide does not verify a security audit or certification; ask the AegisOne team for that evidence.',
    ur: 'AegisOne فشنگ کی شناخت میں مدد دیتا ہے، لیکن مکمل حفاظت کی ضمانت نہیں دیتا۔ کچھ خطرات شناخت سے رہ سکتے ہیں اور درست مواد بھی مشکوک قرار پا سکتا ہے۔ حفاظت تنصیب اور ترتیب پر منحصر ہے۔ منتظم کی اسناد محفوظ رکھیں، مشکوک نتائج کا جائزہ لیں اور اپنی IT ٹیم سے ڈیپلائمنٹ چیک کرائیں۔ یہ گائیڈ سکیورٹی آڈٹ یا سرٹیفکیشن کی تصدیق نہیں کرتی؛ اس کا ثبوت AegisOne ٹیم سے لیں۔',
    'ur-Latn': 'AegisOne phishing pehchanne mein madad karta hai, lekin mukammal safety ki guarantee nahi deta. Kuch threats miss ho sakte hain aur durust content bhi suspicious flag ho sakta hai. Protection installation aur configuration par depend karti hai. Admin credentials mehfooz rakhein, suspicious results review karein aur IT team se deployment check karwayein. Yeh guide security audit ya certification verify nahi karti; saboot AegisOne team se lein.',
  },
  clockRequest: {
    en: 'I focus on AegisOne and do not provide a live clock or current date. Please check your device’s clock. I can help with product features, plans or setup.',
    ur: 'میں AegisOne کے بارے میں مدد دیتا ہوں اور موجودہ وقت یا تاریخ کی تصدیق نہیں کرتا۔ براہ کرم اپنے آلے کی گھڑی دیکھیں۔ میں پروڈکٹ کی خصوصیات، پلان یا سیٹ اپ سمجھا سکتا ہوں۔',
    'ur-Latn': 'Main AegisOne ke bare mein madad karta hoon aur live waqt ya aaj ki tareekh verify nahi karta. Apne device ki ghari dekhein. Main product features, plans ya setup samjha sakta hoon.',
  },
  integration: {
    en: 'To integrate AegisOne with your organization:\n1. Register your organization, confirm the account and open the deployment portal. Complete approval if requested.\n2. Install and start Docker on your server, follow the portal’s Windows or Linux deployment instructions, and check service readiness.\n3. Complete Organization, Review Structure, Validation, Security/SMTP and Rollout in the setup dashboard.\n4. Have employees install the browser extension and connect it to your organization’s service.\nFor an application or API integration, use the /docs reference served by your installed FastAPI backend and follow its authentication requirements. Specific CRM, SIEM, webhook or other third-party connectors are not verified by this quick guide; confirm compatibility with the team.',
    ur: 'AegisOne کو اپنے ادارے کے ساتھ منسلک کرنے کے لیے:\n۱۔ ادارہ رجسٹر کریں، اکاؤنٹ کی تصدیق کریں اور ڈیپلائمنٹ پورٹل کھولیں۔ اگر منظوری درکار ہو تو اسے مکمل کریں۔\n۲۔ اپنے سرور پر Docker انسٹال اور شروع کریں، پورٹل کی Windows یا Linux ہدایات پر عمل کریں اور سروس کی تیاری چیک کریں۔\n۳۔ سیٹ اپ ڈیش بورڈ میں ادارے کی معلومات، شعبے و ملازمین، ویلیڈیشن، SMTP اور رول آؤٹ مکمل کریں۔\n۴۔ ملازمین براؤزر ایکسٹینشن انسٹال کر کے اسے ادارے کی سروس سے منسلک کریں۔\nاپنی ایپ یا API کے لیے نصب شدہ FastAPI بیک اینڈ کا /docs حوالہ اور اس کی تصدیقِ شناخت کی شرائط دیکھیں۔ مخصوص CRM، SIEM، ویب ہُک یا دوسری سروس کے کنیکٹر کی یہاں تصدیق نہیں؛ مطابقت ٹیم سے معلوم کریں۔',
    'ur-Latn': 'AegisOne ko apni organization se integrate karne ke liye:\n1. Organization register karein, account confirm karein aur deployment portal kholein. Agar approval darkar ho to complete karein.\n2. Apne server par Docker install aur start karein, portal ki Windows ya Linux instructions follow karein aur readiness check karein.\n3. Setup dashboard mein Organization, Review Structure, Validation, Security/SMTP aur Rollout complete karein.\n4. Employees browser extension install karke organization ki service se connect karein.\nApni app ya API ke liye installed FastAPI backend ka /docs reference aur authentication requirements dekhein. Specific CRM, SIEM, webhook ya third-party connector yahan verified nahi; compatibility team se confirm karein.',
  },
  gettingStarted: {
    en: 'Start on the AegisOne website with Register Org or Request Organization Setup.\n1. Register your organization, confirm your account and complete approval if requested.\n2. Have IT install and start Docker on your server. Follow the deployment portal’s Windows or Linux instructions; wait for its readiness check before opening the setup dashboard.\n3. Complete five steps: Organization (profile), Review Structure (departments and employees, manually or CSV), Validation (fix duplicates and assignments), Security (configure and test SMTP), then Rollout (review account and welcome-email results).\n4. Have employees install the browser extension and connect it to your organization’s service.\nAlready registered? Open the deployment portal first.',
    ur: 'AegisOne ویب سائٹ پر Register Org یا Request Organization Setup سے آغاز کریں۔\n۱۔ ادارہ رجسٹر کریں، اکاؤنٹ کی تصدیق کریں اور اگر منظوری درکار ہو تو مکمل کریں۔\n۲۔ IT منتظم سے سرور پر Docker انسٹال اور شروع کرائیں۔ ڈیپلائمنٹ پورٹل کی Windows یا Linux ہدایات پر عمل کریں؛ تیاری کی جانچ کے بعد سیٹ اپ ڈیش بورڈ کھولیں۔\n۳۔ پانچ مرحلے مکمل کریں: Organization میں ادارے کی معلومات، Review Structure میں شعبے اور ملازمین دستی طور پر یا CSV سے، Validation میں نقول اور تقرریوں کی درستی، Security میں SMTP کی ترتیب اور ٹیسٹ، پھر Rollout میں اکاؤنٹ اور ویلکم ای میل کے نتائج کا جائزہ۔\n۴۔ ملازمین براؤزر ایکسٹینشن انسٹال کر کے اسے ادارے کی سروس سے منسلک کریں۔\nرجسٹریشن ہو چکی ہے؟ پہلے ڈیپلائمنٹ پورٹل کھولیں۔',
    'ur-Latn': 'AegisOne website par Register Org ya Request Organization Setup se shuru karein.\n1. Organization register karein, account confirm karein aur approval darkar ho to complete karein.\n2. IT admin se server par Docker install aur start karwayein. Deployment portal ki Windows ya Linux instructions follow karein; readiness check ke baad setup dashboard kholein.\n3. Paanch steps complete karein: Organization mein profile, Review Structure mein departments aur employees manually ya CSV se, Validation mein duplicates aur assignments durust karein, Security mein SMTP configure aur test karein, phir Rollout mein account aur welcome-email results review karein.\n4. Employees browser extension install karke organization ki service se connect karein.\nRegistration ho chuki hai? Pehle deployment portal kholein.',
  },
  launchDate: {
    en: 'I do not have a verified public launch date for AegisOne in the reviewed project guide. Version numbers and repository activity do not establish a launch date. Ask the AegisOne team for the confirmed date or release history.',
    ur: 'جائزہ شدہ پروجیکٹ گائیڈ میں AegisOne کی عوامی لانچ کی مصدقہ تاریخ موجود نہیں ہے۔ ورژن نمبر یا ریپوزٹری کی سرگرمی لانچ کی تاریخ ثابت نہیں کرتی۔ تصدیق شدہ تاریخ یا ریلیز کی تاریخچہ ٹیم سے معلوم کریں۔',
    'ur-Latn': 'Reviewed project guide mein AegisOne ki public launch ki verified tareekh maujood nahi. Version number ya repository activity launch date ka saboot nahi. Confirmed tareekh ya release history AegisOne team se poochain.',
  },
  unknown: {
    en: 'I do not have a verified answer to that question in this local quick guide. I can help with AegisOne’s features, plans, installation, integration steps and setup issues. Ask a more specific product question, or ask the team to confirm a missing project fact.',
    ur: 'اس مقامی مختصر گائیڈ میں اس سوال کا مصدقہ جواب موجود نہیں ہے۔ میں AegisOne کی خصوصیات، پلان، تنصیب، انٹیگریشن کے مراحل اور سیٹ اپ کے مسائل میں مدد دے سکتا ہوں۔ پروڈکٹ کے بارے میں مزید واضح سوال پوچھیں، یا نامعلوم پروجیکٹ معلومات کی تصدیق ٹیم سے کرائیں۔',
    'ur-Latn': 'Is local quick guide mein is sawal ka verified jawab maujood nahi. Main AegisOne ke features, plans, installation, integration steps aur setup issues mein madad kar sakta hoon. Product ke bare mein zyada wazeh sawal poochein, ya missing project fact team se confirm karein.',
  },
  outOfScope: {
    en: 'I’m here to help with AegisOne. Ask me about its phishing protection, plans, installation, integrations, privacy or organization setup. Which of those would you like to explore?',
    ur: 'میں AegisOne کے بارے میں مدد کے لیے یہاں ہوں۔ آپ اس کی فشنگ سے حفاظت، پلان، تنصیب، انٹیگریشن، رازداری یا ادارے کے سیٹ اپ کے بارے میں پوچھ سکتے ہیں۔ آپ کس موضوع پر بات کرنا چاہیں گے؟',
    'ur-Latn': 'Main AegisOne ke baray mein madad ke liye yahan hoon. Aap us ki phishing protection, plans, installation, integrations, privacy ya organization setup ke baray mein pooch sakte hain. Aap kis topic par baat karna chahein ge?',
  },
  greeting: {
    en: 'Hello! I can explain AegisOne, its plans, how to integrate it with your organization, or your current setup step. What would you like to understand?',
    ur: 'سلام! میں AegisOne، اس کے پلان، ادارے کے ساتھ انٹیگریشن یا موجودہ سیٹ اپ مرحلے کی وضاحت کر سکتا ہوں۔ آپ کس موضوع کو سمجھنا چاہتے ہیں؟',
    'ur-Latn': 'Salam! Main AegisOne, us ke plans, organization ke sath integration ya current setup step samjha sakta hoon. Aap kis topic ko samajhna chahte hain?',
  },
  limitations: {
    en: 'This quick guide uses reviewed project information rather than a live model. It cannot verify an unpublished launch date, a custom integration, a security guarantee, certification or negotiated commercial terms. It also cannot run commands or change your setup. Use the project guide for known behavior and ask the team to confirm anything not documented.',
    ur: 'یہ مختصر گائیڈ جائزہ شدہ پروجیکٹ معلومات استعمال کرتی ہے۔ یہ غیر شائع شدہ لانچ تاریخ، مخصوص انٹیگریشن، حفاظت کی ضمانت، سرٹیفکیشن یا تجارتی شرائط کی تصدیق نہیں کر سکتی۔ یہ کمانڈ بھی نہیں چلاتی اور سیٹ اپ تبدیل نہیں کرتی۔ معلوم طریقۂ کار کے لیے گائیڈ دیکھیں اور غیر دستاویزی بات کی تصدیق ٹیم سے کرائیں۔',
    'ur-Latn': 'Yeh quick guide reviewed project information use karti hai. Unpublished launch date, custom integration, security guarantee, certification ya commercial terms verify nahi kar sakti. Commands nahi chalati aur setup change nahi karti. Known behavior ke liye guide dekhein; undocumented baat team se confirm karein.',
  },
  pricing: {
    en: 'The published plans are Starter Shield (1–100 employees): $20 monthly or $150 per year; Growth Defense (101–1,000): $79 monthly or $699 per year; Enterprise Guardian (1,001+): $199 monthly or $1,799 per year. Annual prices are totals for a year. Confirm custom terms, support commitments and integrations with the team before purchase.',
    ur: 'شائع شدہ پلان: اسٹارٹر شیلڈ، ۱ سے ۱۰۰ ملازمین، ماہانہ ۲۰ ڈالر یا سالانہ ۱۵۰ ڈالر؛ گروتھ ڈیفنس، ۱۰۱ سے ۱۰۰۰ ملازمین، ماہانہ ۷۹ ڈالر یا سالانہ ۶۹۹ ڈالر؛ انٹرپرائز گارڈین، ۱۰۰۱ یا زیادہ، ماہانہ ۱۹۹ ڈالر یا سالانہ ۱۷۹۹ ڈالر۔ سالانہ رقم پورے سال کی ہے۔ خصوصی شرائط، معاونت اور انٹیگریشن کی تصدیق ٹیم سے کریں۔',
    'ur-Latn': 'Starter Shield (1–100 employees): $20 mahana ya $150 saalana. Growth Defense (101–1,000): $79 mahana ya $699 saalana. Enterprise Guardian (1,001+): $199 mahana ya $1,799 saalana. Saalana qeemat poore saal ki hai. Custom terms, support aur integrations team se confirm karein.',
  },
  deployment: {
    en: 'The Setup Engine is your organization’s setup dashboard, hosted on your server on port 3002. It helps configure AegisOne; you control setup, and the assistant does not run it for you.\nOn the deployment portal:\n1. Install and start Docker on your server.\n2. Follow the portal’s Windows or Linux instructions and run its displayed deployment command in a terminal on that server. Keep generated commands and deployment keys private.\n3. Enter the server’s IP or domain; use localhost only when the server is this computer. Check readiness. Once ready, click Start Setup Engine to open the dashboard.\n4. Complete Organization (profile), Review Structure (departments and employees), Validation (fix records), Security (configure and test SMTP), then Rollout (review accounts and welcome-email results).',
    ur: 'Setup Engine آپ کے ادارے کا سیٹ اپ ڈیش بورڈ ہے جو آپ کے اپنے سرور پر پورٹ 3002 پر چلتا ہے۔ اس سے AegisOne کی ترتیب مکمل ہوتی ہے؛ سیٹ اپ آپ خود کنٹرول کرتے ہیں، معاون اسے آپ کی جگہ نہیں چلاتا۔\nڈیپلائمنٹ پورٹل پر:\n۱۔ اپنے سرور پر Docker انسٹال اور شروع کریں۔\n۲۔ پورٹل کی Windows یا Linux ہدایات کے مطابق دکھائی گئی ڈیپلائمنٹ کمانڈ اسی سرور کے ٹرمینل میں چلائیں۔ کمانڈز اور ڈیپلائمنٹ کیز نجی رکھیں۔\n۳۔ سرور کا IP یا ڈومین درج کریں؛ localhost صرف اسی کمپیوٹر پر چلنے والے سرور کے لیے ہے۔ تیاری چیک کریں۔ سروس تیار ہو تو Start Setup Engine سے ڈیش بورڈ کھولیں۔\n۴۔ Organization میں ادارے کی معلومات، Review Structure میں شعبے اور ملازمین، Validation میں ریکارڈ کی درستگی، Security میں SMTP کی ترتیب اور ٹیسٹ، پھر Rollout میں اکاؤنٹس اور ویلکم ای میل کے نتائج چیک کریں۔',
    'ur-Latn': 'Setup Engine aap ki organization ka setup dashboard hai jo aap ke apne server par port 3002 par chalta hai. Yeh AegisOne configure karne mein madad karta hai; setup aap control karte hain, assistant aap ki jagah nahi chalata.\nDeployment portal par:\n1. Apne server par Docker install aur start karein.\n2. Portal ki Windows ya Linux instructions ke mutabiq dikhayi gayi deployment command usi server ke terminal mein chalayein. Commands aur deployment keys private rakhein.\n3. Server ka IP ya domain dein; localhost sirf isi computer par chalne wale server ke liye hai. Readiness check karein. Ready hone par Start Setup Engine se dashboard kholein.\n4. Organization mein profile, Review Structure mein departments aur employees, Validation mein records durust karein, Security mein SMTP configure aur test karein, phir Rollout mein accounts aur welcome-email results review karein.',
  },
  'setup-organization': {
    en: 'Check your organization name and industry in the setup form and verify the signed-in administrator account. Complete required fields before moving on. I can highlight a field, but you control all changes. Keep personal details and passwords in the actual form.',
    ur: 'سیٹ اپ فارم میں ادارے کا نام اور صنعت چیک کریں اور سائن ان شدہ منتظم اکاؤنٹ کی تصدیق کریں۔ اگلے مرحلے سے پہلے ضروری خانے مکمل کریں۔ میں خانے کی نشان دہی کر سکتا ہوں، تبدیلی آپ خود کریں۔ ذاتی معلومات اور پاس ورڈ اصل فارم میں رکھیں۔',
    'ur-Latn': 'Setup form mein organization ka naam aur industry check karein aur signed-in admin account verify karein. Agle step se pehle required fields complete karein. Main field highlight kar sakta hoon; changes aap khud karein. Personal details aur passwords asal form mein rakhein.',
  },
  'setup-structure': {
    en: 'Create departments and add employees manually or import the downloadable CSV template. Its six columns are Employee ID, First Name, Last Name, Email, Department Code and Role. Preserve the headers; quoted fields can contain commas. Review IDs, department codes and roles after import, then resolve duplicates or unassigned records in Validation. Keep employee files in the setup workflow.',
    ur: 'شعبے بنائیں اور ملازمین دستی طور پر یا ڈاؤن لوڈ کردہ CSV ٹیمپلیٹ سے شامل کریں۔ اس کے چھ کالم Employee ID، First Name، Last Name، Email، Department Code اور Role ہیں۔ عنوانات برقرار رکھیں؛ اقتباس میں لکھے خانے میں کاما ہو سکتا ہے۔ امپورٹ کے بعد شناخت، شعبے اور کردار چیک کریں۔ دہرائے گئے یا غیر منسلک ریکارڈ ویلیڈیشن میں درست کریں۔ ملازمین کی فائل سیٹ اپ میں رکھیں۔',
    'ur-Latn': 'Departments banayein aur employees manually ya downloaded CSV template se add karein. Is ke chhe columns Employee ID, First Name, Last Name, Email, Department Code aur Role hain. Headers na badlein; quoted fields mein comma aa sakta hai. Import ke baad IDs, departments aur roles review karein. Duplicate aur unassigned records Validation mein durust karein. Employee file setup workflow mein rakhein.',
  },
  'setup-validation': {
    en: 'Review duplicate employee IDs, duplicate emails, invalid rows and employees without a department. Open the affected group and correct records in the setup table. Validation must pass before continuing; the assistant cannot bypass it.',
    ur: 'دہرائی گئی شناخت، ای میل، غلط قطاریں اور شعبے کے بغیر ملازمین چیک کریں۔ متعلقہ گروپ کھول کر سیٹ اپ ٹیبل میں درست کریں۔ آگے بڑھنے سے پہلے ویلیڈیشن کامیاب ہونا ضروری ہے۔ معاون اسے نظر انداز نہیں کر سکتا۔',
    'ur-Latn': 'Duplicate employee IDs, duplicate emails, invalid rows aur department ke baghair employees check karein. Affected group khol kar setup table mein durust karein. Aage barhne se pehle validation pass honi chahiye; assistant isay bypass nahi kar sakta.',
  },
  'setup-security': {
    en: 'Configure your email provider’s SMTP host, port, username and approved password in the form, then run the existing connection test yourself. Authentication errors usually require checking provider settings or an app password; network errors require checking reachability. Never send SMTP credentials to the assistant.',
    ur: 'فارم میں ای میل فراہم کنندہ کا ایس ایم ٹی پی ہوسٹ، پورٹ، صارف نام اور منظور شدہ پاس ورڈ درج کریں، پھر موجودہ کنکشن ٹیسٹ خود چلائیں۔ تصدیق کی خرابی میں فراہم کنندہ کی سیٹنگ یا ایپ پاس ورڈ چیک کریں۔ نیٹ ورک کی خرابی میں رابطہ چیک کریں۔ اسناد معاون کو نہ بھیجیں۔',
    'ur-Latn': 'Form mein email provider ka SMTP host, port, username aur approved password bharein, phir connection test khud chalayein. Auth error par provider settings ya app password check karein; network error par connectivity dekhein. SMTP credentials assistant ko na bhejein.',
  },
  'setup-rollout': {
    en: 'Review account provisioning and email-dispatch results before finishing. If delivery fails or its status is unknown, check existing accounts and delivery results before deciding whether a retry is appropriate. Account creation or email delivery alone does not prove browser protection is active; employees must install and connect the extension.',
    ur: 'مکمل کرنے سے پہلے اکاؤنٹ بننے اور ای میل بھیجنے کے نتائج چیک کریں۔ ارسال ناکام یا اس کی حالت نامعلوم ہو تو دوبارہ کوشش کا فیصلہ کرنے سے پہلے موجودہ اکاؤنٹ اور نتائج دیکھیں۔ اکاؤنٹ بننا یا ای میل پہنچنا اکیلے براؤزر کی حفاظت کا ثبوت نہیں؛ ملازمین کو ایکسٹینشن انسٹال اور منسلک کرنی ہے۔',
    'ur-Latn': 'Finish se pehle provisioning aur email dispatch results dekhein. Delivery fail ya status unknown ho to retry ka faisla karne se pehle existing accounts aur results check karein. Account banna ya email milna browser protection active hone ka saboot nahi; employees ko extension install aur connect karni hai.',
  },
  privacy: {
    en: 'Cloud assistance sends your questions, opt-in voice recordings and a small approved setup-status summary to our hosted service and Groq. Automatic context does not include employee records, credentials, scan content or screen images. This application does not save audio. Chat sessions expire after 24 hours; dedicated transcription sessions expire after 15 minutes. New chat requests deletion of the current session. Local quick guides work without cloud AI.',
    ur: 'کلاؤڈ معاونت آپ کے سوال، اجازت سے ریکارڈ کردہ آواز اور سیٹ اپ کی محدود منظور شدہ کیفیت ہماری ہوسٹڈ سروس اور Groq کو بھیجتی ہے۔ خودکار معلومات میں ملازمین کے ریکارڈ، اسناد، اسکین مواد یا اسکرین تصاویر شامل نہیں ہوتیں۔ ایپ آواز محفوظ نہیں کرتی۔ چیٹ ۲۴ گھنٹے اور مخصوص آواز کی نشست ۱۵ منٹ بعد ختم ہوتی ہے۔ نئی چیٹ موجودہ نشست حذف کرنے کی درخواست کرتی ہے۔ مقامی مختصر گائیڈ کلاؤڈ AI کے بغیر چلتی ہے۔',
    'ur-Latn': 'Cloud help aap ke sawal, opt-in voice recording aur limited approved setup status hamari hosted service aur Groq ko bhejti hai. Automatic context mein employee records, credentials, scan content ya screen images nahi hotin. App audio save nahi karti. Chat 24 ghante aur dedicated transcription session 15 minutes mein expire hoti hai. New chat current session delete karne ki request karti hai. Local quick guides cloud AI ke baghair chalti hain.',
  },
  contact: {
    en: 'You can contact the AegisOne team or request a demo using the website contact form. A request is not a confirmed appointment. The team must confirm meeting availability and any custom commercial terms.',
    ur: 'ویب سائٹ کے رابطہ فارم سے ایجس ون ٹیم سے رابطہ یا ڈیمو کی درخواست کریں۔ درخواست تصدیق شدہ ملاقات نہیں ہے۔ ملاقات کے وقت اور خصوصی کاروباری شرائط کی تصدیق ٹیم کرے گی۔',
    'ur-Latn': 'Website contact form se AegisOne team ko message ya demo request bhej sakte hain. Request confirmed meeting nahi hoti. Meeting ka waqt aur custom commercial terms team confirm karegi.',
  },
} satisfies Record<string, LocalCopy>;

type Topic = keyof typeof HELP;
const SHORT_GUIDES = {
  prerequisites: {
    en: 'For company deployment, prepare:\n• A confirmed organization portal account and approval if required.\n• A Windows or Linux server with administrator access, Docker Desktop/Engine and Docker Compose.\n• PowerShell on Windows, or a shell and curl on Linux; internet access for deployment downloads.\n• A server IP or domain reachable by employees. The usual API/dashboard ports are 8000/3002.\n\nDuring setup, you will also need department/employee details and an SMTP sending account for welcome emails. Enter credentials only in the setup form.\n\nMinimum CPU, RAM, disk and GPU requirements are not verified in this guide; have IT confirm capacity for your workload.',
    ur: 'ادارے میں تنصیب کے لیے تیار رکھیں:\n• تصدیق شدہ ادارے کا پورٹل اکاؤنٹ اور ضروری منظوری۔\n• Windows یا Linux سرور، منتظم کا اختیار، Docker Desktop/Engine اور Docker Compose۔\n• Windows پر PowerShell یا Linux پر شیل اور curl، اور ڈاؤن لوڈ کے لیے انٹرنیٹ۔\n• ملازمین کی رسائی والا سرور IP یا ڈومین؛ API اور ڈیش بورڈ کی عام پورٹس 8000/3002 ہیں۔\n\nبعد کے سیٹ اپ میں شعبوں اور ملازمین کی معلومات اور ویلکم ای میل کے لیے SMTP اکاؤنٹ درکار ہوگا۔ اسناد صرف فارم میں درج کریں۔\n\nکم از کم CPU، RAM، ڈسک یا GPU کی تصدیق یہاں موجود نہیں؛ IT سے اپنے کام کے مطابق گنجائش طے کرائیں۔',
    'ur-Latn': 'Company deployment ke liye tayyar rakhein:\n• Confirmed organization portal account aur zaroori approval.\n• Windows ya Linux server, admin access, Docker Desktop/Engine aur Docker Compose.\n• Windows par PowerShell ya Linux par shell aur curl; downloads ke liye internet.\n• Employees ki access wala server IP ya domain; aam API/dashboard ports 8000/3002 hain.\n\nBaad ke setup mein department/employee details aur welcome emails ke liye SMTP account chahiye. Credentials sirf setup form mein dein.\n\nMinimum CPU, RAM, disk ya GPU requirements yahan verified nahi; IT se workload ke mutabiq capacity confirm karwayein.',
  },
  start: {
    en: 'Start with Register Org or Request Organization Setup on the website. Confirm your account and complete approval if requested.\n\nThen use the deployment portal to install AegisOne with Docker, finish organization setup, and connect employee browser extensions.\n\nHave you registered your organization yet?',
    ur: 'AegisOne ویب سائٹ پر Register Org یا Request Organization Setup سے شروع کریں۔ اکاؤنٹ کی تصدیق اور اگر ضروری ہو تو منظوری مکمل کریں۔\n\nپھر ڈیپلائمنٹ پورٹل سے Docker کے ذریعے تنصیب، ادارے کا سیٹ اپ اور ملازمین کی براؤزر ایکسٹینشن کا رابطہ مکمل کریں۔\n\nکیا آپ کا ادارہ رجسٹر ہو چکا ہے؟',
    'ur-Latn': 'AegisOne website par Register Org ya Request Organization Setup se shuru karein. Account confirm karein aur approval darkar ho to complete karein.\n\nPhir deployment portal se Docker installation, organization setup aur employee browser extensions ka connection complete karein.\n\nKya aap ki organization register ho chuki hai?',
  },
  integration: {
    en: 'There are two paths:\n1. For your organization: register it, deploy AegisOne with Docker, complete setup, then connect employee browser extensions.\n2. For an app or API: use your installed backend’s /docs reference and its authentication requirements.\n\nAre you setting it up for your organization or connecting an existing application?',
    ur: 'دو راستے ہیں:\n۱۔ ادارے کے لیے: رجسٹر کریں، Docker سے AegisOne نصب کریں، سیٹ اپ مکمل کریں اور ملازمین کی براؤزر ایکسٹینشن منسلک کریں۔\n۲۔ ایپ یا API کے لیے: نصب شدہ بیک اینڈ کا /docs حوالہ اور تصدیقِ شناخت کی شرائط دیکھیں۔\n\nآپ ادارے کا سیٹ اپ کر رہے ہیں یا کسی موجودہ ایپ کو جوڑنا چاہتے ہیں؟',
    'ur-Latn': 'Do raste hain:\n1. Organization ke liye: register karein, Docker se AegisOne deploy karein, setup complete karein aur employee browser extensions connect karein.\n2. App ya API ke liye: installed backend ka /docs reference aur authentication requirements dekhein.\n\nAap organization ka setup kar rahe hain ya existing application connect karna chahte hain?',
  },
  registered: {
    en: 'Since you have registered, open the deployment portal after confirming your account and any required approval. Install and start Docker on the server, then follow the portal’s command for your operating system.\n\nWill that server run Windows or Linux?',
    ur: 'رجسٹریشن ہو گئی ہے تو اکاؤنٹ کی تصدیق اور ضروری منظوری کے بعد ڈیپلائمنٹ پورٹل کھولیں۔ سرور پر Docker انسٹال اور شروع کریں، پھر اپنے آپریٹنگ سسٹم کے لیے پورٹل کی کمانڈ استعمال کریں۔\n\nآپ کا سرور Windows پر چلے گا یا Linux پر؟',
    'ur-Latn': 'Registration ho chuki hai to account confirmation aur zaroori approval ke baad deployment portal kholein. Server par Docker install aur start karein, phir apne operating system ki portal command follow karein.\n\nAap ka server Windows par chalega ya Linux par?',
  },
  windows: {
    en: 'For Windows, install and start Docker Desktop on the server. In your deployment portal, select Windows and run the displayed deployment command on that machine.\n\nWait for the readiness check, then choose Start Setup Engine to open the setup dashboard. Keep the generated command and credentials private.',
    ur: 'Windows سرور پر Docker Desktop انسٹال اور شروع کریں۔ ڈیپلائمنٹ پورٹل میں Windows منتخب کریں اور دکھائی گئی کمانڈ اسی مشین پر چلائیں۔\n\nتیاری کی جانچ کے بعد Start Setup Engine سے سیٹ اپ ڈیش بورڈ کھولیں۔ کمانڈ اور اسناد نجی رکھیں۔',
    'ur-Latn': 'Windows server par Docker Desktop install aur start karein. Deployment portal mein Windows select karein aur dikhayi gayi command usi machine par chalayein.\n\nReadiness check ke baad Start Setup Engine se setup dashboard kholein. Generated command aur credentials private rakhein.',
  },
  linux: {
    en: 'On your Linux server, install and start Docker Engine. Select Linux in the deployment portal and run its deployment command on that server.\n\nOnce readiness is confirmed, choose Start Setup Engine and complete the organization setup wizard.',
    ur: 'Linux سرور پر Docker Engine انسٹال اور شروع کریں۔ ڈیپلائمنٹ پورٹل میں Linux منتخب کر کے اس کی کمانڈ اسی سرور پر چلائیں۔\n\nتیاری کی تصدیق کے بعد Start Setup Engine کھولیں اور ادارے کا سیٹ اپ مکمل کریں۔',
    'ur-Latn': 'Linux server par Docker Engine install aur start karein. Deployment portal mein Linux select karke us ki command usi server par chalayein.\n\nReadiness confirm hone par Start Setup Engine kholein aur organization setup complete karein.',
  },
  dockerReady: {
    en: 'With Docker installed, make sure it is running. Open your deployment portal and run its Windows or Linux deployment command on the server. Wait for readiness before choosing Start Setup Engine.\n\nThe wizard then guides your organization profile, staff, validation, email setup and rollout.',
    ur: 'Docker انسٹال ہے تو تصدیق کریں کہ چل رہا ہے۔ ڈیپلائمنٹ پورٹل کی Windows یا Linux کمانڈ سرور پر چلائیں۔ تیاری کی جانچ کے بعد Start Setup Engine کھولیں۔\n\nوزارڈ ادارے کی معلومات، ملازمین، ویلیڈیشن، ای میل اور رول آؤٹ میں رہنمائی کرے گا۔',
    'ur-Latn': 'Docker installed hai to check karein ke chal raha hai. Deployment portal ki Windows ya Linux command server par chalayein. Readiness check ke baad Start Setup Engine kholein.\n\nWizard organization profile, staff, validation, email setup aur rollout mein guide karega.',
  },
  api: {
    en: 'For an application integration, open /docs on your installed AegisOne backend. Find the endpoint for your task and follow that version’s authentication, request and response definitions.\n\nSpecific third-party connectors are not verified in this guide. Which application or workflow do you want to connect?',
    ur: 'ایپ منسلک کرنے کے لیے نصب شدہ AegisOne بیک اینڈ کا /docs کھولیں۔ مطلوبہ کام کا اینڈپوائنٹ اور اسی ورژن کی تصدیقِ شناخت، درخواست اور جواب کی تعریفیں دیکھیں۔\n\nمخصوص کنیکٹر کی یہاں تصدیق نہیں۔ آپ کون سی ایپ یا کام کا طریقہ منسلک کرنا چاہتے ہیں؟',
    'ur-Latn': 'Application integration ke liye installed AegisOne backend ka /docs kholein. Apne kaam ka endpoint aur us version ki authentication, request aur response definitions dekhein.\n\nSpecific third-party connectors yahan verified nahi. Aap kaunsi application ya workflow connect karna chahte hain?',
  },
  simple: {
    en: 'The short version: register your organization, use the portal to install AegisOne on your server with Docker, then finish the setup wizard. After that, connect employee browser extensions. Start with registration if you have not done it yet.',
    ur: 'آسان الفاظ میں: ادارہ رجسٹر کریں، پورٹل سے Docker کے ذریعے سرور پر AegisOne نصب کریں، پھر سیٹ اپ وزارڈ مکمل کریں۔ آخر میں ملازمین کی براؤزر ایکسٹینشن منسلک کریں۔ اگر رجسٹریشن نہیں ہوئی تو وہیں سے شروع کریں۔',
    'ur-Latn': 'Asaan alfaaz mein: organization register karein, portal se Docker ke zariye server par AegisOne install karein, phir setup wizard complete karein. Aakhir mein employee browser extensions connect karein. Registration nahi hui to wahan se shuru karein.',
  },
  simpleRegistered: {
    en: 'The short version: start Docker on your server, then run the deployment command from your portal. When the readiness check confirms the service is ready, choose Start Setup Engine. The wizard will guide the remaining setup.',
    ur: 'مختصر طریقہ: سرور پر Docker شروع کریں، پھر پورٹل کی ڈیپلائمنٹ کمانڈ چلائیں۔ سروس تیار ہونے کی تصدیق کے بعد Start Setup Engine کھولیں۔ باقی سیٹ اپ میں وزارڈ رہنمائی کرے گا۔',
    'ur-Latn': 'Mukhtasar tareeqa: server par Docker start karein, phir portal ki deployment command chalayein. Service ready hone ki tasdeeq ke baad Start Setup Engine kholein. Baqi setup mein wizard guide karega.',
  },
} satisfies Record<string, LocalCopy>;
function normalizeQuestion(message: string): string {
  return message.normalize('NFKC').toLowerCase().replace(/[\u064B-\u065F\u0670]/g, '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/\b(?:shoul|shoud|shud)\b/g, 'should').replace(/\b(?:wher|whre)\b/g, 'where')
    .replace(/\b(?:frist|frst)\b/g, 'first').replace(/\bstrt\b/g, 'start').replace(/\b(?:setp|setuo|setpu)\b/g, 'setup')
    .replace(/\baegis[\s-]+one\b/g, 'aegisone')
    .replace(/\b(this|that|the|your) (?:(?:security|phishing(?: protection)?) )?(?:software|solution|application|platform|system|tool|service|app)\b/g, '$1 product')
    .replace(/\b(?:aegione|aegison|aegis|ageisone|aegisne|aegisonne)\b/g, 'aegisone')
    .replace(/\b(?:integrte|intergrate|intregrate)\b/g, 'integrate').replace(/\bintergration\b/g, 'integration')
    .replace(/\b(?:conect|connet)\b/g, 'connect').replace(/\binstll\b/g, 'install')
    .replace(/\borganisations?\b/g, word => word.endsWith('s') ? 'organizations' : 'organization')
    .replace(/\b(?:comapny|compnay)\b/g, 'company');
}
function asksForPrerequisites(message: string): boolean {
  const q = normalizeQuestion(message);
  if (/\b(?:smtp|csv|password|api authentication)\b/.test(q) && !/\b(?:deploy\w*|install\w*|server|hardware)\b/.test(q)) return false;
  return /\b(?:prerequisites?|requirements?|resources?|hardware|ram|cpu|gpu|memory|disk|bandwidth|specifications?|specs|laptop|vm|virtual machine)\b|\b(?:tools?|software|equipment|machine|accounts?)\b.*\b(?:need|required|prepare)\b|\b(?:need|require|prepare)\b.*\b(?:tools?|equipment|machine|accounts?|before (?:setup|installation))\b|کیا.*(?:ضروری|ضرورت|درکار)|\b(?:kya|konse|kaunse)\b.*\b(?:chahiye|darkar|zaroori)\b/.test(q);
}
function asksForSetupOverview(message: string): boolean {
  return /\b(?:from (?:the )?(?:beginning|scratch)|start (?:over|to finish)|(?:full|complete|whole|entire) (?:setup|process|guide)|(?:setup|process) overview|all (?:the )?(?:setup )?steps)\b|شروع سے|پورا.*(?:سیٹ اپ|طریقہ)|تمام.*مراحل|\bshuru se\b|\b(?:poora|pura|sara) (?:setup|process|tareeqa)\b/.test(normalizeQuestion(message));
}
/** Bounded conversational questions; an optional greeting must not hide another request. */
function directQuestion(message: string): string {
  return normalizeQuestion(message).replace(/[?!.،؛:۔؟,'’]+/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^(?:hi|hello|hey|salam|salaam|assalam[ -]?(?:o[ -]?)?alaikum|assalamu[ -]?alaikum|سلام|السلام علیکم|اسلام علیکم|وعلیکم السلام)(?: (?:aegis[ -]?one|ایجس[ -]?ون|ایگیس[ -]?ون))?\s+/, '');
}
function directIntent(message: string): Topic | null {
  const q = directQuestion(message);
  if (/^(?:please )?(?:why (?:are you|r u) here|why are you on this (?:page|site|website)|what (?:are you here for|is your (?:purpose|role)|can you help(?: me)? with|do you help(?: me)? with)|who are you|what are you|how can you help(?: me)?|what is (?:this|the) (?:chatbot|assistant)(?: for)?)(?: please)?$/.test(q)
    || /^(?:آپ یہاں کیوں ہیں|تم یہاں کیوں ہو|آپ کا مقصد کیا ہے|آپ کون ہیں|آپ کس چیز میں مدد کر سکتے ہیں|یہ معاون کس لیے ہے|یہ چیٹ بوٹ کس لیے ہے)$/.test(q)
    || /^(?:aap yahan kyun hain|tum yahan kyun ho|aap ka maqsad kya hai|tumhara maqsad kya hai|aap (?:kon|kaun) hain|aap (?:kis cheez mein|kaise) madad kar sakte hain)$/.test(q)) return 'purpose';
  if (/^(?:please )?(?:(?:tell|show|give)(?: me)? )?(?:what (?:is|s) (?:(?:the )?(?:time|date)(?: today| now| right now)?|today s date)|what (?:time|date)(?: is it)?(?: today| now| right now)?|(?:the )?current (?:time|date)|today s date|(?:time|date)(?: today| now)?|what day is (?:it|today))(?: please)?$/.test(q)
    || /^(?:ابھی کیا وقت ہے|آج کیا تاریخ ہے|آج کی تاریخ کیا ہے|کیا وقت ہوا ہے|وقت کیا ہے|کتنے بجے ہیں|آج کون سا دن ہے)$/.test(q)
    || /^(?:abhi (?:kya time hai|kitne baje hain)|aaj (?:ki (?:date|tareekh|tarikh) kya hai|kya (?:date|tareekh|tarikh|din) hai)|(?:time|waqt) kya hai)$/.test(q)) return 'clockRequest';
  if (/^(?:(?:is|are) (?:aegis[ -]?one|this (?:product|platform|app|service|software)|it) (?:safe|secure|trustworthy|reliable)(?: to use| for (?:my|our) (?:team|organization|company))?|how (?:safe|secure|reliable) is (?:aegis[ -]?one|this (?:product|platform|app)|it)|can i trust (?:aegis[ -]?one|this (?:product|platform|app)))(?: please)?$/.test(q)
    || /^(?:کیا )?(?:ایجس[ -]?ون|ایگیس[ -]?ون|یہ (?:پروڈکٹ|ایپ|پلیٹ فارم)) (?:محفوظ|قابل اعتماد)(?: ہے)?$/.test(q)
    || /^(?:kya )?(?:aegis[ -]?one|yeh? (?:product|app|platform)) (?:safe|secure|mehfooz|mahfooz) hai$/.test(q)) return 'safety';
  if (/^(?:please )?(?:(?:tell me|explain) )?what (?:(?:does|can) (?:aegis[ -]?one|it|this (?:product|platform|app))|(?:aegis[ -]?one|it|this (?:product|platform|app))(?: can| does)?) (?:do|offer)(?: for (?:my|our) (?:team|organization|company))?$/.test(q)
    || /^(?:ایجس[ -]?ون|ایگیس[ -]?ون|یہ (?:پروڈکٹ|ایپ|پلیٹ فارم)) کیا (?:کر سکتا ہے|کرتا ہے)$/.test(q)
    || /^(?:aegis[ -]?one|yeh? (?:product|app|platform)) kya (?:kar sakta hai|karta hai)$/.test(q)) return 'features';
  return null;
}
/** Match a complete request about the visible page, without reading page content. */
function asksForCurrentPage(message: string): boolean {
  const q = normalizeQuestion(message).replace(/[?!.،؛:۔؟,]+/g, ' ').replace(/\s+/g, ' ').trim();
  return /^(?:please )?(?:(?:tell|show)(?: me)? )?(?:(?:in|on) (?:this|the current) (?:page|screen) )?what (?:(?:do|should|can) i do|do i (?:have|need) to do|i (?:have|need) to do|i should do|to do)(?: (?:here|now|next|(?:in|on) (?:this|the current) (?:page|screen)))?$/.test(q)
    || /^(?:please )?(?:(?:explain|describe)(?: to me)?|help me understand|guide me through|tell me about) (?:this|the current) (?:page|screen)$/.test(q)
    || /^(?:براہ کرم )?(?:(?:مجھے )?(?:بتائیں|سمجھائیں) )?(?:(?:اس|موجودہ) (?:صفحے|صفحہ|اسکرین) (?:پر|میں) |یہاں )?(?:میں )?(?:کیا کروں|کیا کرنا ہے|کیا کرنا چاہیے)(?: (?:یہاں|اس (?:صفحے|صفحہ|اسکرین) (?:پر|میں)))?(?: (?:بتائیں|سمجھائیں))?$/.test(q)
    || /^(?:یہ|موجودہ) (?:صفحہ|اسکرین) (?:سمجھائیں|بتائیں)$/.test(q)
    || /^(?:(?:mujhe|please) )?(?:(?:is|iss|yeh|ye|current) (?:page|screen) (?:par|pe|mein) |yahan )?(?:mujhe )?kya (?:karna hai|karna chahiye|karun|karon|kroon|krun|krna hai|krna chahiye)(?: (?:yahan|(?:is|iss) (?:page|screen) (?:par|pe|mein)))?(?: (?:batao|batayein|samjhao|samjhayein))?$/.test(q)
    || /^(?:yeh|ye|is|iss) (?:page|screen) (?:samjhao|samjhayein)$/.test(q);
}
function intent(message: string): Topic | 'current' {
  const q = normalizeQuestion(message);
  const project = /\baegis[ -]?one\b|ایجس[ -]?ون|ایگیس[ -]?ون|\b(?:this|your) (?:project|product|platform)\b|اس پروجیکٹ/.test(q);
  // A greeting may address the assistant, but must not swallow a second question.
  if (/^\s*(?:hi|hello|hey|salam|salaam|assalam[ -]?(?:o[ -]?)?alaikum|assalamu[ -]?alaikum|سلام|السلام علیکم|اسلام علیکم|وعلیکم السلام)(?:[!?.،؛:۔؟,\s-]+(?:aegis[ -]?one|ایجس[ -]?ون|ایگیس[ -]?ون))?[!?.،؛:۔؟,\s]*$/.test(q)) return 'greeting';
  // These unrelated requests can contain broad guide keywords such as "plan"
  // or "price". Keep them from selecting a misleading product answer.
  if (/\b(?:capital of|capital city|weather|politics|political news|president|prime minister|elections?|rizz|skibidi|gyat|slang)\b|سیاست|سیاسی خبریں|وزیر اعظم|صدر کون|دارالحکومت|موسم|\b(?:siyasat|siyasi|wazir[ -]?e?[ -]?azam|sadar kon)\b/.test(q)
    || /\b(?:price|cost|rate)\b.{0,24}\b(?:gold|silver|oil|bitcoin|petrol)\b|(?:سونے|چاندی|پٹرول).*قیمت|\b(?:gold|silver|sone|chandi|petrol)\s+ki\s+(?:qeemat|keemat)\b/.test(q)
    || /\bplan\s+(?:(?:a|my|our|the)\s+)?(?:holiday|vacation|trip|wedding)\b/.test(q)) return 'outOfScope';
  const direct = directIntent(q);
  if (direct) return direct;
  if (asksForPrerequisites(q)) return 'deployment';
  if (asksForCurrentPage(q)) return 'current';
  if (/\b(?:setup|set[ -]?up) engine\b|سیٹ ?اپ انجن/.test(q)) return 'deployment';
  if (/launch|releas|لانچ|اجرا|متعارف/.test(q) && /when|date|year|\bkab\b|tareekh|tarikh|کب|تاریخ|کس سال/.test(q) && !/setup|dashboard|سیٹ اپ|ڈیش بورڈ/.test(q)) return 'launchDate';
  if (/\bfounder\b|founded by|who.*(?:creat|found|built|owns?)|\bceo\b|بانی|کس نے.*(?:بنای|شروع)|مالک/.test(q) && project) return 'unknown';
  if (/integrat|\bapi\b|\bsiem\b|webhook|\bconnect\b|\bhook up\b|\bplug\b|انٹیگری|انٹگری|جوڑ|منسلک|\bjor(?:na|ne|ain|ein|en)?\b/.test(q)) return 'integration';
  if (/pric|\bplans\b|^\s*plan[?!.\s]*$|\bwhich plan\b|\b(?:your|our|monthly|annual|yearly|subscription|starter|growth|enterprise) plan\b|cost|billing|قیمت|پلان|خرچ|qeemat|keemat|mahana|saalana|kitne pais|\b(?:konsa|kaunsa|kon sa|kaun sa) plan\b/.test(q)) return 'pricing';
  if (/priv|data.*(?:stor|sent|shar|retain)|cloud|screen|credential|رازداری|پرائیوی|ڈیٹا|اسکرین|mahfooz.*data/.test(q)) return 'privacy';
  if (/meet|demo|contact|human|رابطہ|ملاقات|\brabta\b|\bteam se\b/.test(q)) return 'contact';
  if (/smtp|app.?password|email server|ایس ایم ٹی پی/.test(q)) return 'setup-security';
  if (/duplicate|validat|unassigned|invalid|دہر|ویلیڈ|غلط.*(?:قطار|سی ایس وی)|بغیر.*شعب|duplicate|ghalat.*csv/.test(q)) return 'setup-validation';
  if (/csv|import|department|employee.*(?:add|upload)|سی ایس وی|شعب|ملازمین.*شامل|محکم|employees.*add/.test(q)) return 'setup-structure';
  if (/rollout|dispatch|welcome email|credentials.*sent|رول آؤٹ|رول آوٹ|ارسال|اکاؤنٹ.*بن/.test(q)) return 'setup-rollout';
  if (/organization name|industry|org.*profile|ادارے.*نام|صنعت|ادارے.*معلومات/.test(q)) return 'setup-organization';
  if (/\b(?:setup|set[ -]?up|getting started|get started|first step|start first|do first|new here|registration|registered|prerequisites?|requirements?|walkthrough|checklist|step by step|walk me through)\b|\bwhere\b.{0,40}\b(?:start|begin)\b|\bhow\b.{0,24}\b(?:start|begin)\b|\b(?:start|begin)\b.{0,24}\b(?:setup|using|aegis[ -]?one)\b|\bset(?:ting)?\b.{0,12}\bup\b|سیٹ ?اپ|کہاں.*شروع|شروع.*(?:کہاں|کیسے)|پہلا.*(?:قدم|مرحلہ)|\b(?:shuru|shuroo|shroo|pehla step)\b/.test(q) || asksForSetupOverview(q)) return 'gettingStarted';
  if (/this step|current step|what.*next|why.*(?:continue|proceed)|stuck|help.*setup|یہ مرحلہ|اگلا|آگے.*(?:بڑھ|کیا)|agla|aglay|aage.*(?:barh|kya)|yeh step|yeh.*samjh|^\s*help\s*[?!۔؟]*$/.test(q)) return 'current';
  if (/install|docker|deploy|setup|set up|server|readiness|container|انسٹال|تنصیب|ڈوکر|سیٹ اپ|سرور/.test(q)) return 'deployment';
  if (/feature|capabilit|protect|phish|detect|scan|how (?:does |do )?(?:aegis[ -]?one|it|this (?:project|product|platform))\b.*\bworks?\b|what (?:does|can|do) (?:aegis[ -]?one|it|you|this (?:project|product|platform))\b.*\b(?:do|offer)\b|خصوصیات|حفاظت|فشنگ|شناخت|کام.*کیسے|kaise.*kaam|(?:aegis[ -]?one|yeh|ye|یہ).*kya.*karta/.test(q)) return 'features';
  if (/explain.*(?:aegis|project)|what is (?:the )?aegis[ -]?one(?: (?:project|platform|product|app))?[?؟!.۔\s]*$|tell.*about.*aegis|aegis.*(?:kya hai|کیا ہے)|ایجس ون.*کیا|ایجس.*سمجھ|project.*(?:samjh|kya)|پروجیکٹ.*سمجھ|^\s*aegis[ -]?one[?؟!.\s]*$/.test(q)) return 'overview';
  if (/guarantee|certif|compliance|sla|accuracy|uptime|ضمانت|سرٹیف|یقینی/.test(q)) return 'limitations';
  return project ? 'unknown' : 'outOfScope';
}

type FieldId = keyof NonNullable<SafeContext['fieldStatus']>;
const FIELD_NAMES: Partial<Record<FieldId, LocalCopy>> = {
  org_name: { en: 'organization name', ur: 'ادارے کا نام', 'ur-Latn': 'organization ka naam' },
  org_industry: { en: 'industry', ur: 'صنعت', 'ur-Latn': 'industry' },
  admin_email: { en: 'administrator account email', ur: 'منتظم اکاؤنٹ کی ای میل', 'ur-Latn': 'admin account email' },
  smtp_host: { en: 'SMTP host', ur: 'SMTP ہوسٹ', 'ur-Latn': 'SMTP host' },
  smtp_port: { en: 'SMTP port', ur: 'SMTP پورٹ', 'ur-Latn': 'SMTP port' },
  smtp_username: { en: 'SMTP username', ur: 'SMTP صارف نام', 'ur-Latn': 'SMTP username' },
  smtp_password: { en: 'SMTP password', ur: 'SMTP پاس ورڈ', 'ur-Latn': 'SMTP password' },
};
const ISSUE_NAMES: Record<string, LocalCopy> = {
  duplicateIds: { en: 'members with duplicate IDs', ur: 'ملازمین کی شناخت دہرائی گئی ہے', 'ur-Latn': 'members ke IDs duplicate hain' },
  duplicateEmails: { en: 'members with duplicate emails', ur: 'ملازمین کی ای میل دہرائی گئی ہے', 'ur-Latn': 'members ke emails duplicate hain' },
  unassignedMembers: { en: 'members without a department', ur: 'ملازمین کسی شعبے سے منسلک نہیں', 'ur-Latn': 'members ka department assigned nahi' },
  invalidRows: { en: 'members with invalid required fields', ur: 'ملازمین کے ضروری خانے غلط ہیں', 'ur-Latn': 'members ke required fields invalid hain' },
};
const ISSUE_GROUPS: Record<string, string> = { duplicateIds: 'duplicate_ids', duplicateEmails: 'duplicate_emails', unassignedMembers: 'unassigned_members', invalidRows: 'invalid_csv' };
function contextDetails(topic: Topic, context: SafeContext): { copy: LocalCopy; actions: AssistantAction[] } {
  const parts: LocalCopy[] = []; const actions: AssistantAction[] = [];
  const errors = context.errors || [];
  if (topic === 'setup-organization' || topic === 'setup-security') {
    const keys = topic === 'setup-organization' ? ['org_name', 'org_industry', 'admin_email'] as const : ['smtp_host', 'smtp_port', 'smtp_username', 'smtp_password'] as const;
    const missing = keys.filter(key => context.fieldStatus?.[key] === false);
    if (missing.length) {
      const names = (lang: Language) => missing.map(key => FIELD_NAMES[key]![lang]).join(', ');
      parts.push({ en: `Still required or invalid: ${names('en')}.`, ur: `یہ خانے ابھی نامکمل یا غلط ہیں: ${names('ur')}۔`, 'ur-Latn': `Yeh fields abhi required ya invalid hain: ${names('ur-Latn')}.` });
      actions.push({ type: 'highlight_field', target: missing[0] });
    }
  }
  if (topic === 'setup-structure' || topic === 'setup-validation') {
    const issueKeys = Object.keys(ISSUE_NAMES).filter(key => (context.counts?.[key as keyof NonNullable<SafeContext['counts']>] || 0) > 0);
    if (issueKeys.length) {
      const summary = (lang: Language) => issueKeys.map(key => `${context.counts![key as keyof NonNullable<SafeContext['counts']>]} ${ISSUE_NAMES[key][lang]}`).join('; ');
      parts.push({ en: `The current draft reports: ${summary('en')}. Counts can overlap. Fix these records in Review Structure before continuing.`, ur: `موجودہ ڈرافٹ کے مطابق: ${summary('ur')}۔ ایک ریکارڈ کئی شمار میں آ سکتا ہے۔ آگے بڑھنے سے پہلے Review Structure میں درست کریں۔`, 'ur-Latn': `Current draft report: ${summary('ur-Latn')}. Counts overlap kar sakte hain. Aage barhne se pehle Review Structure mein records durust karein.` });
      actions.push({ type: 'show_validation_group', target: ISSUE_GROUPS[issueKeys[0]] });
    } else if (errors.includes('invalid_csv')) {
      parts.push({ en: 'The last CSV import could not be read. Download a fresh template and check headers, column counts and quoting before uploading again.', ur: 'آخری CSV امپورٹ پڑھی نہیں جا سکی۔ نیا ٹیمپلیٹ ڈاؤن لوڈ کر کے عنوانات، کالموں کی تعداد اور اقتباسی نشان چیک کریں۔', 'ur-Latn': 'Pichli CSV import parhi nahi ja saki. Naya template download karke headers, column count aur quoting check karein.' });
      actions.push({ type: 'show_validation_group', target: 'invalid_csv' });
    }
  }
  if (topic === 'setup-security') {
    if (errors.includes('smtp_auth')) parts.push({ en: 'The last SMTP test reported an authentication problem. Check the provider’s username and app-password requirements in the form, then run the test yourself.', ur: 'آخری SMTP ٹیسٹ میں تصدیقِ شناخت کا مسئلہ آیا۔ فارم میں فراہم کنندہ کے صارف نام اور ایپ پاس ورڈ کی شرائط چیک کر کے خود دوبارہ ٹیسٹ چلائیں۔', 'ur-Latn': 'Pichlay SMTP test mein authentication issue aya. Form mein provider ke username aur app-password requirements check karke test khud dobara chalayein.' });
    else if (errors.includes('smtp_network')) parts.push({ en: 'The last SMTP test reported a network problem. Ask IT to check the SMTP address, approved outbound connection and firewall rules.', ur: 'آخری SMTP ٹیسٹ میں نیٹ ورک کا مسئلہ آیا۔ IT سے SMTP پتہ، بیرونی رابطہ اور فائر وال کی شرائط چیک کرائیں۔', 'ur-Latn': 'Pichlay SMTP test mein network issue aya. IT se SMTP address, approved outbound connection aur firewall rules check karwayein.' });
    else if (errors.includes('smtp_tls')) parts.push({ en: 'The last SMTP test reported a TLS problem. Verify the provider-required host, port and security settings; do not disable TLS to bypass the error.', ur: 'آخری SMTP ٹیسٹ میں TLS کا مسئلہ آیا۔ فراہم کنندہ کی مطلوبہ ہوسٹ، پورٹ اور حفاظتی ترتیب چیک کریں؛ خرابی سے بچنے کے لیے TLS بند نہ کریں۔', 'ur-Latn': 'Pichlay SMTP test mein TLS issue aya. Provider ki required host, port aur security settings check karein; error bypass karne ke liye TLS band na karein.' });
  }
  if (topic === 'setup-rollout') {
    if (context.rollout === 'running') parts.push({ en: 'Dispatch is still running. Wait for its delivery result; it is not complete yet.', ur: 'ارسال ابھی جاری ہے۔ نتیجے کا انتظار کریں؛ یہ ابھی مکمل نہیں ہوا۔', 'ur-Latn': 'Dispatch abhi running hai. Delivery result ka intezar karein; abhi complete nahi hua.' });
    else if (context.rollout === 'unknown' || errors.includes('dispatch_unknown')) parts.push({ en: 'Delivery status could not be confirmed. Accounts may already exist. Check the dashboard before repeating dispatch.', ur: 'ارسال کی حالت کی تصدیق نہیں ہو سکی۔ اکاؤنٹ پہلے سے بن چکے ہو سکتے ہیں۔ دوبارہ ارسال سے پہلے ڈیش بورڈ چیک کریں۔', 'ur-Latn': 'Delivery status confirm nahi ho saka. Accounts pehle se ban chuke ho sakte hain. Dispatch repeat karne se pehle dashboard check karein.' });
    else if (context.rollout === 'partial_failure' || errors.includes('dispatch_partial')) {
      const failed = context.counts?.failed;
      parts.push({ en: `Some welcome emails failed${failed === undefined ? '' : ` (${failed} reported failures)`}. Review delivery results before retrying.`, ur: `کچھ ویلکم ای میل ناکام ہوئیں${failed === undefined ? '' : ` (${failed} ناکام نتائج)`}۔ دوبارہ کوشش سے پہلے نتائج دیکھیں۔`, 'ur-Latn': `Kuch welcome emails fail huin${failed === undefined ? '' : ` (${failed} reported failures)`}. Retry se pehle delivery results dekhein.` });
    } else if (context.rollout === 'completed') parts.push({ en: 'Dispatch reports completion. Next, check employee activation and extension connections.', ur: 'ارسال مکمل ہونے کی اطلاع ہے۔ اب ملازمین کے اکاؤنٹ کی فعالیت اور ایکسٹینشن کے رابطے چیک کریں۔', 'ur-Latn': 'Dispatch completion report ho rahi hai. Ab employee activation aur extension connections check karein.' });
  }
  if (topic === 'deployment') {
    if (context.readiness === 'slow' || context.readiness === 'timeout') parts.push({ en: 'The readiness check has not confirmed a ready service. Check Docker/container health and local server connectivity; first startup can take longer.', ur: 'تیاری کی جانچ نے سروس تیار ہونے کی تصدیق نہیں کی۔ Docker، کنٹینرز اور سرور سے رابطہ چیک کریں؛ پہلی بار شروع ہونے میں وقت لگ سکتا ہے۔', 'ur-Latn': 'Readiness check ne ready service confirm nahi ki. Docker, containers aur local server connectivity check karein; pehli startup mein der ho sakti hai.' });
    else if (context.readiness === 'unknown') parts.push({ en: 'This browser could not verify server readiness. Check the server locally; an unknown result is not proof of success or failure.', ur: 'یہ براؤزر سرور کی تیاری کی تصدیق نہیں کر سکا۔ سرور مقامی طور پر چیک کریں؛ نامعلوم نتیجہ کامیابی یا ناکامی کا ثبوت نہیں۔', 'ur-Latn': 'Yeh browser server readiness verify nahi kar saka. Server locally check karein; unknown result success ya failure ka saboot nahi.' });
    else if (context.readiness === 'ready') parts.push({ en: 'The readiness check reports ready. Continue to the organization setup dashboard.', ur: 'تیاری کی جانچ کے مطابق سروس تیار ہے۔ ادارے کا سیٹ اپ ڈیش بورڈ کھولیں۔', 'ur-Latn': 'Readiness check ready report kar raha hai. Organization setup dashboard kholein.' });
    if (context.os === 'macos') parts.push({ en: 'The portal’s verified deployment commands cover Windows and Linux. Ask the team for macOS-specific guidance.', ur: 'پورٹل کی تصدیق شدہ کمانڈز Windows اور Linux کے لیے ہیں۔ macOS کی ہدایات ٹیم سے معلوم کریں۔', 'ur-Latn': 'Portal ki verified commands Windows aur Linux ke liye hain. macOS-specific guidance team se lein.' });
  }
  return { copy: { en: parts.map(part => part.en).join('\n\n'), ur: parts.map(part => part.ur).join('\n\n'), 'ur-Latn': parts.map(part => part['ur-Latn']).join('\n\n') }, actions };
}

const SETUP_TOPICS = new Set(['gettingStarted', 'integration', 'deployment']);
function followupTopic(message: string, previous?: Topic | 'current'): Topic | 'current' {
  const matched = intent(message);
  if (!previous || !SETUP_TOPICS.has(previous)) return matched;
  const q = directQuestion(message);
  if (/^(?:(?:i am|i m|we are|using|on|for|with|what about|how about) )?(?:using )?(?:windows(?: 10| 11| server)?|linux|ubuntu|docker|(?:my|our|an?|the) (?:company|organization|server)|organization)(?: please)?$/.test(q)) return 'deployment';
  if (/^(?:(?:for|with|my|our|an?|the) )?(?:app|application|api)(?: integration)?$/.test(q)) return 'integration';
  if (/^(?:please )?(?:make (?:it|that|this) (?:shorter|simpler|clearer)|(?:explain|say) (?:it|that|this) (?:simply|in simple (?:words|terms))|(?:shorter|simpler|step by step)(?: please)?|i (?:do not|still do not|don t) understand|what next|next step)$/.test(q)) return previous;
  return matched;
}

/** Local guidance uses bounded user turns only; never generated answers or form values. */
export function getFallbackReply(message: string, language: Language, inputContext: SafeContext, history: readonly string[] = []): AssistantReply {
  const context = sanitizeContext(inputContext);
  let previous: Topic | 'current' | undefined;
  for (const turn of history.slice(-6)) {
    const topic = followupTopic(turn.slice(0, 2000), previous);
    previous = ['outOfScope', 'unknown', 'greeting'].includes(topic) ? undefined : topic;
  }
  let matched = followupTopic(message, previous);
  // Once setup is underway, broad help follows the current step. A request
  // for the whole process still gets the complete getting-started guide.
  if (matched === 'gettingStarted' && !asksForSetupOverview(message)) {
    if (context.surface === 'organization_setup' && context.step) matched = 'current';
    else if (context.surface === 'deployment_portal') matched = 'deployment';
  }
  let topic: Topic = matched === 'current'
    ? context.surface === 'organization_setup' && context.step ? `setup-${context.step}`
      : context.surface === 'deployment_portal' ? 'deployment'
      : context.section === 'pricing' ? 'pricing' : context.section === 'features' ? 'features' : 'gettingStarted'
    : matched;
  // Generic next-step requests follow the reported blocker, rather than inventing a screen read.
  if (matched === 'current' && context.surface === 'organization_setup' && ['structure', 'validation'].includes(context.step || '')
    && context.errors?.some(error => ['duplicate_ids', 'duplicate_emails', 'unassigned_members', 'invalid_csv'].includes(error))) topic = 'setup-validation';
  const source = topic === 'integration' || topic === 'gettingStarted' ? 'deployment' : topic === 'launchDate' || topic === 'unknown' || topic === 'safety' ? 'limitations' : topic === 'greeting' || topic === 'purpose' || topic === 'clockRequest' || topic === 'outOfScope' ? 'overview' : topic;
  const details = contextDetails(topic, context);
  let guide: LocalCopy = HELP[topic];
  if (context.surface === 'landing' && SETUP_TOPICS.has(topic) && !asksForSetupOverview(message)) {
    const q = directQuestion(message);
    const relevant = /\b(?:shorter|simpler|clearer|simply|simple words|simple terms|understand)\b/.test(q) && previous;
    if (asksForPrerequisites(q)) guide = SHORT_GUIDES.prerequisites;
    else if (/\b(?:already|finished|completed|have|am)\b.{0,30}\bregist(?:ered|ration)\b/.test(q) && !/\b(?:not|never|haven t|haven't)\b/.test(q)) guide = SHORT_GUIDES.registered;
    else if (/\b(?:installed|have|running)\b.{0,15}\bdocker\b|\bdocker (?:is )?(?:installed|running)\b/.test(q) && !/\b(?:not|never)\b/.test(q)) guide = SHORT_GUIDES.dockerReady;
    else if (/\bwindows\b/.test(q)) guide = SHORT_GUIDES.windows;
    else if (/\b(?:linux|ubuntu)\b/.test(q)) guide = SHORT_GUIDES.linux;
    else if (topic === 'integration') guide = /\b(?:api|app|application|webhook|siem|crm)\b/.test(q) ? SHORT_GUIDES.api
      : /\b(?:my|our|the) (?:company|organization|organisation|business|workplace|office|team)\b/.test(q) ? SHORT_GUIDES.start : SHORT_GUIDES.integration;
    else if (relevant) {
      const progress = [...history, message].reverse().find(turn => /\b(?:registered|registration)\b/.test(normalizeQuestion(turn))) || '';
      guide = /\b(?:already|finished|completed|have|am)\b/.test(progress) && !/\b(?:not|never)\b/.test(progress) ? SHORT_GUIDES.simpleRegistered : SHORT_GUIDES.simple;
    }
    else if (topic === 'gettingStarted') guide = SHORT_GUIDES.start;
  }
  const text = (lang: Language) => [details.copy[lang], guide[lang]].filter(Boolean).join('\n\n');
  const actions: AssistantAction[] = topic === 'clockRequest' ? [] : [...details.actions, { type: 'open_documentation', target: source }];
  if (topic === 'launchDate' || topic === 'unknown' || topic === 'integration' || topic === 'limitations' || topic === 'safety') actions.push({ type: 'contact_team', target: 'contact' });
  return {
    turnId: newId(), answer: text(language), speechText: text(language === 'ur-Latn' ? 'ur' : language), language,
    sources: topic === 'integration' ? ['deployment', 'features', 'limitations'] : topic === 'gettingStarted' ? ['deployment', 'setup-organization'] : topic === 'safety' ? ['features', 'limitations'] : topic === 'clockRequest' ? [] : [source], status: 'fallback',
    actions: actions.filter(action => isAllowedAction(action, context)).slice(0, 4),
  };
}
export interface AssistantHint { id: string; text: string; prompt: string }
/** A local rule catalog. The UI handles dwell/cooldown/dismissal; this never invokes AI. */
export function getHint(context: SafeContext, language: Language): AssistantHint | null {
  const errors = context.errors || [];
  let id = '';
  if (errors.some(e => ['duplicate_ids', 'duplicate_emails', 'unassigned_members', 'invalid_csv'].includes(e))) id = 'setup-validation';
  else if (errors.some(e => e.startsWith('smtp_'))) id = 'setup-security';
  else if (context.rollout === 'partial_failure' || errors.includes('dispatch_partial') || errors.includes('dispatch_unknown')) id = 'setup-rollout';
  else if (context.readiness === 'slow' || context.readiness === 'timeout') id = 'deployment';
  else if (context.surface === 'landing' && context.section === 'pricing') id = 'pricing';
  else if (context.surface === 'landing' && context.section === 'features') id = 'overview';
  else return null;
  const text: LocalCopy = { en: 'Need help understanding this step?', ur: 'کیا اس مرحلے کو سمجھنے میں مدد چاہیے؟', 'ur-Latn': 'Is step ko samajhne mein madad chahiye?' };
  const prompt: LocalCopy = { en: id === 'pricing' ? 'Which plan fits my team?' : 'Explain this step and what I should check next.', ur: id === 'pricing' ? 'میری ٹیم کے لیے کون سا پلان مناسب ہے؟' : 'یہ مرحلہ سمجھائیں اور بتائیں کہ آگے کیا چیک کروں۔', 'ur-Latn': id === 'pricing' ? 'Meri team ke liye konsa plan theek hai?' : 'Yeh step samjhayein aur batayein ab kya check karoon.' };
  return { id, text: text[language], prompt: prompt[language] };
}
