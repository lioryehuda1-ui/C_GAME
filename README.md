# 🦕 DINO RUSH - משחק הדינוזאורים

**למשחק שון (גיל 8) ודין (גיל 9)! 🦖**

## משחק מרהיב עם:
- 🦕 שון - ברונטוזאאורוס ירוק
- 🦖 דין - T-REX כתום
- ❤️ 5 לבבות חיים עם HUD בתחתית
- 🌵 מכשולים: קקטוס, סלעים, פטרודקטיל, כדורי אש
- ⭐ מערכת שלבים + ניקוד + שיא אישי
- 💥 אפקטים: פרטיקלים, בזק נזק, קפיצה כפולה!
- 📱 עובד על מובייל (טאץ') + מחשב

## הפעלה מקומית
פשוט פתחו את `game/index.html` בדפדפן.

## פריסה ל-Cloud Run

```bash
# התחברות ל-GCP
gcloud auth login

# הגדרת פרויקט
gcloud config set project YOUR_PROJECT_ID

# פריסה
gcloud run deploy dino-rush \
  --source . \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated
```

## פריסה מהירה ב-Netlify (ללא קוד!)
1. לכו ל-https://app.netlify.com/drop
2. גררו את תיקיית **`game/`** לדף
3. תקבלו `https://xyz.netlify.app` - שלחו לשון ודין! 🎉

## בקרות
| פעולה | מקלדת | מובייל |
|-------|--------|--------|
| קפיצה | SPACE / ↑ | טאץ' |
| קפיצה כפולה | SPACE שנית | טאץ' שנית |
| כריעה | ↓ | - |
| השהיה | P / ESC | כפתור ⏸ |
