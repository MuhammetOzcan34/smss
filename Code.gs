/**
 * Sosyal Medya Yönetim Uygulaması - Ana Kod Dosyası
 */

// Uygulama sabitleri
const APP_CONFIG = {
  appName: "SocialMedia Manager",
  version: "1.0",
  sheetNames: {
    users: "Kullanıcılar",
    clients: "Müşteriler",
    projects: "Projeler",
    contents: "İçerikler",
    calendar: "Takvim",
    suggestions: "Öneriler"
  },
  userRoles: {
    admin: "Yönetici",
    designer: "Tasarımcı",
    client: "Müşteri"
  },
  contentStatuses: {
    preparing: "Hazırlanıyor",
    adminApproval: "Yönetici Onayı Bekliyor",
    clientApproval: "Müşteri Onayı Bekliyor",
    revision: "Revizyonda",
    scheduled: "Planlandı",
    published: "Yayınlandı",
    rejected: "Reddedildi"
  }
};

/**
 * Uygulama başlatma fonksiyonu
 */
function initApp() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Sayfaları oluştur (eğer yoksa)
  Object.values(APP_CONFIG.sheetNames).forEach(sheetName => {
    if (!ss.getSheetByName(sheetName)) {
      const newSheet = ss.insertSheet(sheetName);
      initSheetStructure(newSheet, sheetName);
    }
  });

  // Örnek veriler ekle (geliştirme ortamı için)
  if (isDevelopment()) {
    addSampleData();
  }
}

/**
 * Sayfa yapılarını oluşturur
 * @param {Sheet} sheet - Google Sheets sayfa objesi
 * @param {string} sheetName - Sayfa adı
 */
function initSheetStructure(sheet, sheetName) {
  const headers = getSheetHeaders(sheetName);
  sheet.clear();
  sheet.appendRow(headers);

  // Bazı sütunlara veri doğrulama ekle
  switch (sheetName) {
    case APP_CONFIG.sheetNames.users:
      addDataValidation(sheet, "E2:E", Object.values(APP_CONFIG.userRoles));
      break;
    case APP_CONFIG.sheetNames.contents:
      addDataValidation(sheet, "M2:M", Object.values(APP_CONFIG.contentStatuses));
      addDataValidation(sheet, "N2:N", ["Bekliyor", "Onaylandı", "Reddedildi"]);
      addDataValidation(sheet, "Q2:Q", ["Bekliyor", "Onaylandı", "Reddedildi"]);
      addDataValidation(sheet, "V2:V", ["Evet", "Hayır"]);
      break;
  }
}

/**
 * Web uygulaması için doGet fonksiyonu
 * @return {HtmlOutput} HTML çıktısı
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(APP_CONFIG.appName)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Kullanıcı giriş kontrolü
 * @param {string} email - Kullanıcı emaili
 * @param {string} password - Kullanıcı şifresi
 * @return {Object} Kullanıcı bilgileri veya hata
 */
function userLogin(email, password) {
  const users = getSheetData(APP_CONFIG.sheetNames.users);
  const user = users.find(u => u["Kullanıcı E-posta"] === email && u["Şifre"] === password);

  if (!user) {
    throw new Error("Geçersiz kullanıcı adı veya şifre");
  }

  // Hassas bilgileri çıkar
  delete user["Şifre"];

  return {
    user: user,
    dashboardData: getDashboardData(user)
  };
}

/**
 * Dashboard verilerini getirir
 * @param {Object} user - Kullanıcı bilgileri
 * @return {Object} Dashboard verileri
 */
function getDashboardData(user) {
  const data = {
    stats: {},
    recentActivities: [],
    pendingTasks: []
  };

  const contents = getSheetData(APP_CONFIG.sheetNames.contents);
  const projects = getSheetData(APP_CONFIG.sheetNames.projects);

  // Rol bazlı dashboard verileri
  switch (user["Rol"]) {
    case APP_CONFIG.userRoles.admin:
      data.stats.totalProjects = projects.length;
      data.stats.pendingApprovals = contents.filter(c => c["Durum"] === APP_CONFIG.contentStatuses.adminApproval).length;
      data.stats.activeContents = contents.filter(c =>
        c["Durum"] === APP_CONFIG.contentStatuses.preparing ||
        c["Durum"] === APP_CONFIG.contentStatuses.adminApproval
      ).length;

      data.recentActivities = contents
        .sort((a, b) => new Date(b["Oluşturulma Tarihi"]) - new Date(a["Oluşturulma Tarihi"]))
        .slice(0, 5);

      data.pendingTasks = contents
        .filter(c => c["Durum"] === APP_CONFIG.contentStatuses.adminApproval)
        .slice(0, 5);
      break;

    case APP_CONFIG.userRoles.designer:
      data.stats.assignedTasks = contents.filter(c =>
        c["Tasarımcı ID"] === user["Kullanıcı ID"] &&
        c["Durum"] === APP_CONFIG.contentStatuses.preparing
      ).length;

      data.stats.waitingRevisions = contents.filter(c =>
        c["Tasarımcı ID"] === user["Kullanıcı ID"] &&
        c["Durum"] === APP_CONFIG.contentStatuses.revision
      ).length;

      data.stats.completedThisWeek = contents.filter(c =>
        c["Tasarımcı ID"] === user["Kullanıcı ID"] &&
        c["Durum"] === APP_CONFIG.contentStatuses.adminApproval &&
        isDateInThisWeek(new Date(c["Oluşturulma Tarihi"]))
      ).length;

      data.recentActivities = contents
        .filter(c => c["Tasarımcı ID"] === user["Kullanıcı ID"])
        .sort((a, b) => new Date(b["Oluşturulma Tarihi"]) - new Date(a["Oluşturulma Tarihi"]))
        .slice(0, 5);

      data.pendingTasks = contents
        .filter(c =>
          c["Tasarımcı ID"] === user["Kullanıcı ID"] &&
          (c["Durum"] === APP_CONFIG.contentStatuses.preparing || c["Durum"] === APP_CONFIG.contentStatuses.revision)
        )
        .slice(0, 5);
      break;

    case APP_CONFIG.userRoles.client:
      const clientProjects = projects.filter(p => p["Müşteri ID"] === user["Kullanıcı ID"]);
      const clientContents = contents.filter(c =>
        clientProjects.some(p => p["Proje ID"] === c["Proje ID"])
      );

      data.stats.waitingApprovals = clientContents.filter(c =>
        c["Durum"] === APP_CONFIG.contentStatuses.clientApproval
      ).length;

      data.stats.activeProjects = clientProjects.filter(p =>
        p["Durum"] === "Devam Ediyor"
      ).length;

      data.recentActivities = clientContents
        .sort((a, b) => new Date(b["Oluşturulma Tarihi"]) - new Date(a["Oluşturulma Tarihi"]))
        .slice(0, 5);

      data.pendingTasks = clientContents
        .filter(c => c["Durum"] === APP_CONFIG.contentStatuses.clientApproval)
        .slice(0, 5);
      break;
  }

  return data;
}

/**
 * Yeni içerik oluşturur
 * @param {Object} contentData - İçerik verileri
 * @param {string} userId - Oluşturan kullanıcı ID
 * @return {Object} Oluşturulan içerik
 */
function createContent(contentData, userId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(APP_CONFIG.sheetNames.contents);
  const contents = getSheetData(APP_CONFIG.sheetNames.contents);

  // Yeni ID oluştur
  const newId = generateId("CONT", contents.length + 1);

  // Tarih bilgileri
  const now = new Date();

  // Yeni içerik objesi
  const newContent = {
    "İçerik ID": newId,
    "Proje ID": contentData.projectId,
    "Talep Eden": userId,
    "Sosyal Medya Mecrası": contentData.platform,
    "Paylaşım Türü": contentData.contentType,
    "İçerik Türü": contentData.mediaType,
    "İçerik Metni": contentData.text,
    "Hashtagler": contentData.hashtags,
    "Bağlantılar": contentData.links,
    "Materyal (Görsel/Link)": contentData.material,
    "Tasarımcı ID": contentData.designerId || "",
    "Durum": contentData.designerId ? APP_CONFIG.contentStatuses.preparing : APP_CONFIG.contentStatuses.adminApproval,
    "Yönetici Onayı": "Bekliyor",
    "Yönetici Onay Tarihi": "",
    "Yönetici Notları": "",
    "Müşteri Onayı": "Bekliyor",
    "Müşteri Onay Tarihi": "",
    "Müşteri Notları": "",
    "Yayın Tarihi": contentData.publishDate || "",
    "Yayınlandı Mı": "Hayır",
    "Yayınlanma Tarihi": "",
    "Revizyon Sayısı": 0,
    "Oluşturulma Tarihi": now.toISOString()
  };

  // Sheet'e ekle
  const rowData = Object.keys(getSheetHeaders(APP_CONFIG.sheetNames.contents))
    .map(key => newContent[key] || "");

  sheet.appendRow(rowData);

  // Bildirim gönder
  if (contentData.designerId) {
    sendNotification(contentData.designerId, "Yeni içerik atandı", `Size yeni bir içerik atandı: ${newId}`);
  }

  return newContent;
}

/**
 * İçerik durumunu günceller
 * @param {string} contentId - İçerik ID
 * @param {string} newStatus - Yeni durum
 * @param {string} userId - Güncelleyen kullanıcı ID
 * @param {string} notes - Notlar
 * @return {Object} Güncellenen içerik
 */
function updateContentStatus(contentId, newStatus, userId, notes = "") {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(APP_CONFIG.sheetNames.contents);
  const contents = getSheetData(APP_CONFIG.sheetNames.contents);

  const contentIndex = contents.findIndex(c => c["İçerik ID"] === contentId);
  if (contentIndex === -1) {
    throw new Error("İçerik bulunamadı");
  }

  const content = contents[contentIndex];
  const user = getUserById(userId);

  // Durum geçiş kontrolleri
  switch (newStatus) {
    case APP_CONFIG.contentStatuses.adminApproval:
      if (user["Rol"] !== APP_CONFIG.userRoles.designer) {
        throw new Error("Sadece tasarımcılar yönetici onayına gönderebilir");
      }
      content["Yönetici Onayı"] = "Bekliyor";
      content["Yönetici Onay Tarihi"] = new Date().toISOString();
      break;

    case APP_CONFIG.contentStatuses.clientApproval:
      if (user["Rol"] !== APP_CONFIG.userRoles.admin) {
        throw new Error("Sadece yöneticiler müşteri onayına gönderebilir");
      }
      content["Yönetici Onayı"] = "Onaylandı";
      content["Yönetici Onay Tarihi"] = new Date().toISOString();
      content["Müşteri Onayı"] = "Bekliyor";
      break;

    case APP_CONFIG.contentStatuses.revision:
      if (user["Rol"] === APP_CONFIG.userRoles.admin) {
        content["Yönetici Notları"] = notes;
        content["Yönetici Onayı"] = "Reddedildi";
      } else if (user["Rol"] === APP_CONFIG.userRoles.client) {
        content["Müşteri Notları"] = notes;
        content["Müşteri Onayı"] = "Reddedildi";
      }
      content["Revizyon Sayısı"] = (content["Revizyon Sayısı"] || 0) + 1;
      break;

    case APP_CONFIG.contentStatuses.scheduled:
      if (user["Rol"] !== APP_CONFIG.userRoles.client) {
        throw new Error("Sadece müşteriler onaylayabilir");
      }
      content["Müşteri Onayı"] = "Onaylandı";
      content["Müşteri Onay Tarihi"] = new Date().toISOString();
      break;
  }

  content["Durum"] = newStatus;

  // Sheet'i güncelle
  const headers = getSheetHeaders(APP_CONFIG.sheetNames.contents);
  const rowNumber = contentIndex + 2; // Başlık satırı + 1 tabanlı index

  Object.keys(headers).forEach(key => {
    const colIndex = headers[key];
    sheet.getRange(rowNumber, colIndex).setValue(content[key] || "");
  });

  // Bildirim gönder
  let notificationMessage = "";
  let notificationUserId = "";

  if (newStatus === APP_CONFIG.contentStatuses.adminApproval) {
    notificationMessage = `Yönetici onayı bekleyen yeni içerik: ${contentId}`;
    notificationUserId = getAdminUsers()[0]["Kullanıcı ID"]; // İlk yöneticiye gönder
  } else if (newStatus === APP_CONFIG.contentStatuses.clientApproval) {
    const project = getProjectById(content["Proje ID"]);
    notificationMessage = `Müşteri onayı bekleyen yeni içerik: ${contentId}`;
    notificationUserId = project["Müşteri ID"];
  } else if (newStatus === APP_CONFIG.contentStatuses.revision) {
    notificationMessage = `Revizyon isteği alan içerik: ${contentId}`;
    notificationUserId = content["Tasarımcı ID"];
  }

  if (notificationMessage && notificationUserId) {
    sendNotification(notificationUserId, "İçerik durumu güncellendi", notificationMessage);
  }

  return content;
}

/**
 * Takvim verilerini getirir
 * @param {Object} filters - Filtreler
 * @return {Array} Takvim verileri
 */
function getCalendarData(filters = {}) {
  let calendarData = getSheetData(APP_CONFIG.sheetNames.calendar);
  const contents = getSheetData(APP_CONFIG.sheetNames.contents);

  // İçerik bilgilerini birleştir
  calendarData = calendarData.map(item => {
    const content = contents.find(c => c["İçerik ID"] === item["İçerik ID"]);
    return {
      ...item,
      ...content
    };
  });

  // Filtrele
  if (filters.projectId) {
    calendarData = calendarData.filter(item => item["Proje ID"] === filters.projectId);
  }

  if (filters.platform) {
    calendarData = calendarData.filter(item => item["Sosyal Medya Mecrası"] === filters.platform);
  }

  if (filters.startDate && filters.endDate) {
    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);

    calendarData = calendarData.filter(item => {
      const itemDate = new Date(item["Yayın Tarihi"]);
      return itemDate >= start && itemDate <= end;
    });
  }

  return calendarData;
}

 /**
 * Yeni öneri oluşturur
 * @param {Object} suggestionData - Öneri verileri
 * @param {string} userId - Oluşturan kullanıcı ID
 * @return {Object} Oluşturulan öneri
 */
function createSuggestion(suggestionData, userId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(APP_CONFIG.sheetNames.suggestions);
  const suggestions = getSheetData(APP_CONFIG.sheetNames.suggestions);

  // Yeni ID oluştur
  const newId = generateId("SUG", suggestions.length + 1);

  // Yeni öneri objesi
  const newSuggestion = {
    "Öneri ID": newId,
    "Proje ID": suggestionData.projectId,
    "Açıklama": suggestionData.description,
    "İçerik Türü": suggestionData.contentType,
    "Sosyal Medya Mecrası": suggestionData.platform,
    "Paylaşım Türü": suggestionData.shareType, // "shareType" olarak düzelttim
    "Taslak (Görsel/Link)": suggestionData.draft, // "draft" olarak düzelttim
    "Tahmini Yayın Tarihi": suggestionData.publishDate, // "publishDate" olarak düzelttim
    "Durum": "Bekliyor",
    "Onay Tarihi": "",
    "Reddetme Nedeni": "",
    "Oluşturulma Tarihi": new Date().toISOString()
  };

  // Sheet'e ekle
  const rowData = Object.keys(getSheetHeaders(APP_CONFIG.sheetNames.suggestions))
    .map(key => newSuggestion[key] || "");

  sheet.appendRow(rowData);

  // Müşteriye bildirim gönder
  const project = getProjectById(suggestionData.projectId);
  sendNotification(project["Müşteri ID"], "Yeni içerik önerisi", `Projeniz için yeni bir içerik önerisi oluşturuldu: ${newId}`);

  return newSuggestion;
}