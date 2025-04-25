/**
 * Sosyal Medya Yönetim Uygulaması - Ana Kod Dosyası
 */

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

function initApp() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.values(APP_CONFIG.sheetNames).forEach(sheetName => {
    if (!ss.getSheetByName(sheetName)) {
      const newSheet = ss.insertSheet(sheetName);
      initSheetStructure(newSheet, sheetName);
    }
  });
  if (isDevelopment()) addSampleData();
}

function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Sayfa bulunamadı: ${sheetName}`);
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).map(row => {
    return headers.reduce((obj, header, i) => {
      obj[header] = row[i];
      return obj;
    }, {});
  });
}

function initSheetStructure(sheet, sheetName) {
  const headers = getSheetHeaders(sheetName);
  sheet.clear();
  sheet.appendRow(headers);

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

function getSheetHeaders(sheetName) {
  const headersMap = {
    "Kullanıcılar": ["Kullanıcı ID", "Kullanıcı E-posta", "Şifre", "Ad", "Rol", "Kayıt Tarihi"],
    "İçerikler": ["İçerik ID", "Proje ID", "Talep Eden", "Sosyal Medya Mecrası", "Paylaşım Türü", 
                 "İçerik Türü", "İçerik Metni", "Hashtagler", "Bağlantılar", "Materyal", 
                 "Tasarımcı ID", "Durum", "Yönetici Onayı", "Yönetici Onay Tarihi", 
                 "Yönetici Notları", "Müşteri Onayı", "Müşteri Onay Tarihi", "Müşteri Notları",
                 "Yayın Tarihi", "Yayınlandı Mı", "Yayınlanma Tarihi", "Revizyon Sayısı", 
                 "Oluşturulma Tarihi"]
  };
  return headersMap[sheetName] || [];
}

function addDataValidation(sheet, range, values) {
  const validationRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(range).setDataValidation(validationRule);
}

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(APP_CONFIG.appName)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function userLogin(email, password) {
  try {
    // Giriş bilgilerini temizle
    email = email.toString().trim().toLowerCase();
    password = password.toString().trim();
    
    const users = getSheetData(APP_CONFIG.sheetNames.users);
    const user = users.find(u => {
      const userEmail = u["Kullanıcı E-posta"]?.toString().trim().toLowerCase();
      const userPassword = u["Şifre"]?.toString().trim();
      return userEmail === email && userPassword === password;
    });

    if (!user) {
      console.error("Kullanıcı bulunamadı:", { email, password });
      throw new Error("Geçersiz kullanıcı adı veya şifre");
    }

    const userCopy = JSON.parse(JSON.stringify(user));
    delete userCopy["Şifre"];
    
    return {
      user: userCopy,
      dashboardData: getDashboardData(userCopy)
    };
  } catch (error) {
    console.error("Giriş hatası:", error);
    throw error;
  }
}

function getDashboardData(user) {
  const data = { stats: {}, recentActivities: [], pendingTasks: [] };
  const contents = getSheetData(APP_CONFIG.sheetNames.contents);
  const projects = getSheetData(APP_CONFIG.sheetNames.projects);

  switch (user["Rol"]) {
    case APP_CONFIG.userRoles.admin:
      data.stats.totalProjects = projects.length;
      data.stats.pendingApprovals = contents.filter(c => 
        c["Durum"] === APP_CONFIG.contentStatuses.adminApproval).length;
      data.stats.activeContents = contents.filter(c =>
        [APP_CONFIG.contentStatuses.preparing, APP_CONFIG.contentStatuses.adminApproval]
        .includes(c["Durum"])).length;
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
        c["Durum"] === APP_CONFIG.contentStatuses.preparing).length;
      data.stats.waitingRevisions = contents.filter(c =>
        c["Tasarımcı ID"] === user["Kullanıcı ID"] &&
        c["Durum"] === APP_CONFIG.contentStatuses.revision).length;
      data.stats.completedThisWeek = contents.filter(c =>
        c["Tasarımcı ID"] === user["Kullanıcı ID"] &&
        c["Durum"] === APP_CONFIG.contentStatuses.adminApproval &&
        isDateInThisWeek(new Date(c["Oluşturulma Tarihi"]))).length;
      data.recentActivities = contents
        .filter(c => c["Tasarımcı ID"] === user["Kullanıcı ID"])
        .sort((a, b) => new Date(b["Oluşturulma Tarihi"]) - new Date(a["Oluşturulma Tarihi"]))
        .slice(0, 5);
      data.pendingTasks = contents
        .filter(c => c["Tasarımcı ID"] === user["Kullanıcı ID"] &&
          [APP_CONFIG.contentStatuses.preparing, APP_CONFIG.contentStatuses.revision]
          .includes(c["Durum"]))
        .slice(0, 5);
      break;

    case APP_CONFIG.userRoles.client:
      const clientProjects = projects.filter(p => p["Müşteri ID"] === user["Kullanıcı ID"]);
      const clientContents = contents.filter(c =>
        clientProjects.some(p => p["Proje ID"] === c["Proje ID"]));
      data.stats.waitingApprovals = clientContents.filter(c =>
        c["Durum"] === APP_CONFIG.contentStatuses.clientApproval).length;
      data.stats.activeProjects = clientProjects.filter(p =>
        p["Durum"] === "Devam Ediyor").length;
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

function isDateInThisWeek(date) {
  const today = new Date();
  const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
  const lastDayOfWeek = new Date(firstDayOfWeek);
  lastDayOfWeek.setDate(lastDayOfWeek.getDate() + 6);
  return date >= firstDayOfWeek && date <= lastDayOfWeek;
}

function getUserById(userId) {
  const users = getSheetData(APP_CONFIG.sheetNames.users);
  const user = users.find(u => u["Kullanıcı ID"] === userId);
  if (!user) throw new Error("Kullanıcı bulunamadı");
  return user;
}

function getProjectById(projectId) {
  const projects = getSheetData(APP_CONFIG.sheetNames.projects);
  const project = projects.find(p => p["Proje ID"] === projectId);
  if (!project) throw new Error("Proje bulunamadı");
  return project;
}

function getAdminUsers() {
  const users = getSheetData(APP_CONFIG.sheetNames.users);
  return users.filter(u => u["Rol"] === APP_CONFIG.userRoles.admin);
}

function generateId(prefix, num) {
  return `${prefix}-${num.toString().padStart(3, '0')}`;
}

function sendNotification(userId, title, message) {
  // Bu kısımda e-posta gönderme veya başka bildirim yöntemleri eklenebilir
  console.log(`Bildirim: ${userId}, ${title}, ${message}`);
}

function isDevelopment() {
  // Geliştirme ortamı kontrolü
  return false; // Üretimde false olmalı
}

function addSampleData() {
  // Örnek verileri eklemek için kullanılır
  console.log("Örnek veriler eklendi");
}
