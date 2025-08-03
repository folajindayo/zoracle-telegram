/**
 * Bot Translations
 * 
 * This file contains all text translations for the bot in multiple languages.
 */

export interface Translations {
  [key: string]: {
    [language: string]: string;
  };
}

export const translations: Translations = {
  // Welcome messages
  welcome_title: {
    en: '🤖 Welcome to Zoracle Bot!',
    es: '🤖 ¡Bienvenido a Zoracle Bot!',
    fr: '🤖 Bienvenue sur Zoracle Bot !',
    de: '🤖 Willkommen bei Zoracle Bot!',
    it: '🤖 Benvenuto su Zoracle Bot!',
    pt: '🤖 Bem-vindo ao Zoracle Bot!',
    ru: '🤖 Добро пожаловать в Zoracle Bot!',
    zh: '🤖 欢迎使用 Zoracle Bot！',
    ja: '🤖 Zoracle Botへようこそ！',
    ko: '🤖 Zoracle Bot에 오신 것을 환영합니다!'
  },

  welcome_description: {
    en: 'This bot helps you trade Zora content tokens on Base, manage your portfolio, discover new coins, set alerts, and more.',
    es: 'Este bot te ayuda a comerciar tokens de contenido Zora en Base, gestionar tu portafolio, descubrir nuevas monedas, configurar alertas y más.',
    fr: 'Ce bot vous aide à trader des tokens de contenu Zora sur Base, gérer votre portefeuille, découvrir de nouvelles pièces, définir des alertes et plus encore.',
    de: 'Dieser Bot hilft Ihnen beim Handel mit Zora-Inhaltstoken auf Base, der Verwaltung Ihres Portfolios, der Entdeckung neuer Coins, der Einrichtung von Warnungen und mehr.',
    it: 'Questo bot ti aiuta a fare trading di token di contenuto Zora su Base, gestire il tuo portafoglio, scoprire nuove monete, impostare alert e altro ancora.',
    pt: 'Este bot ajuda você a negociar tokens de conteúdo Zora na Base, gerenciar seu portfólio, descobrir novas moedas, configurar alertas e muito mais.',
    ru: 'Этот бот помогает торговать токенами контента Zora на Base, управлять портфелем, находить новые монеты, устанавливать уведомления и многое другое.',
    zh: '这个机器人帮助您在Base上交易Zora内容代币，管理您的投资组合，发现新币，设置警报等等。',
    ja: 'このボットは、BaseでZoraコンテンツトークンの取引、ポートフォリオの管理、新しいコインの発見、アラートの設定などを支援します。',
    ko: '이 봇은 Base에서 Zora 콘텐츠 토큰 거래, 포트폴리오 관리, 새로운 코인 발견, 알림 설정 등을 도와줍니다.'
  },

  chat_id_label: {
    en: 'Your Chat ID:',
    es: 'Tu ID de Chat:',
    fr: 'Votre ID de Chat :',
    de: 'Ihre Chat-ID:',
    it: 'Il tuo ID Chat:',
    pt: 'Seu ID do Chat:',
    ru: 'Ваш ID чата:',
    zh: '您的聊天ID：',
    ja: 'あなたのチャットID：',
    ko: '귀하의 채팅 ID:'
  },

  // Main menu
  main_menu_title: {
    en: '🏠 Main Menu',
    es: '🏠 Menú Principal',
    fr: '🏠 Menu Principal',
    de: '🏠 Hauptmenü',
    it: '🏠 Menu Principale',
    pt: '🏠 Menu Principal',
    ru: '🏠 Главное меню',
    zh: '🏠 主菜单',
    ja: '🏠 メインメニュー',
    ko: '🏠 메인 메뉴'
  },

  main_menu_subtitle: {
    en: 'What would you like to do today?',
    es: '¿Qué te gustaría hacer hoy?',
    fr: 'Que souhaitez-vous faire aujourd\'hui ?',
    de: 'Was möchten Sie heute tun?',
    it: 'Cosa vorresti fare oggi?',
    pt: 'O que você gostaria de fazer hoje?',
    ru: 'Что вы хотите сделать сегодня?',
    zh: '您今天想做什么？',
    ja: '今日は何をしたいですか？',
    ko: '오늘 무엇을 하고 싶으신가요?'
  },

  // Portfolio
  portfolio_title: {
    en: '💰 Your Portfolio',
    es: '💰 Tu Portafolio',
    fr: '💰 Votre Portefeuille',
    de: '💰 Ihr Portfolio',
    it: '💰 Il tuo Portafoglio',
    pt: '💰 Seu Portfólio',
    ru: '💰 Ваш Портфель',
    zh: '💰 您的投资组合',
    ja: '💰 あなたのポートフォリオ',
    ko: '💰 귀하의 포트폴리오'
  },

  total_value: {
    en: 'Total Value:',
    es: 'Valor Total:',
    fr: 'Valeur Totale :',
    de: 'Gesamtwert:',
    it: 'Valore Totale:',
    pt: 'Valor Total:',
    ru: 'Общая стоимость:',
    zh: '总价值：',
    ja: '総価値：',
    ko: '총 가치:'
  },

  holdings: {
    en: 'Holdings:',
    es: 'Tenencia:',
    fr: 'Détentions :',
    de: 'Bestände:',
    it: 'Possedimenti:',
    pt: 'Posse:',
    ru: 'Владения:',
    zh: '持有：',
    ja: '保有：',
    ko: '보유:'
  },

  // Trading
  trading_title: {
    en: '🔄 Trading',
    es: '🔄 Comercio',
    fr: '🔄 Trading',
    de: '🔄 Handel',
    it: '🔄 Trading',
    pt: '🔄 Negociação',
    ru: '🔄 Торговля',
    zh: '🔄 交易',
    ja: '🔄 取引',
    ko: '🔄 거래'
  },

  trading_subtitle: {
    en: 'What would you like to do?',
    es: '¿Qué te gustaría hacer?',
    fr: 'Que souhaitez-vous faire ?',
    de: 'Was möchten Sie tun?',
    it: 'Cosa vorresti fare?',
    pt: 'O que você gostaria de fazer?',
    ru: 'Что вы хотите сделать?',
    zh: '您想做什么？',
    ja: '何をしたいですか？',
    ko: '무엇을 하고 싶으신가요?'
  },

  buy_tokens: {
    en: '💵 Buy Tokens',
    es: '💵 Comprar Tokens',
    fr: '💵 Acheter des Tokens',
    de: '💵 Token Kaufen',
    it: '💵 Compra Token',
    pt: '💵 Comprar Tokens',
    ru: '💵 Купить Токены',
    zh: '💵 购买代币',
    ja: '💵 トークンを購入',
    ko: '💵 토큰 구매'
  },

  sell_tokens: {
    en: '💸 Sell Tokens',
    es: '💸 Vender Tokens',
    fr: '💸 Vendre des Tokens',
    de: '💸 Token Verkaufen',
    it: '💸 Vendi Token',
    pt: '💸 Vender Tokens',
    ru: '💸 Продать Токены',
    zh: '💸 出售代币',
    ja: '💸 トークンを売却',
    ko: '💸 토큰 판매'
  },

  swap_tokens: {
    en: '🔄 Swap Tokens',
    es: '🔄 Intercambiar Tokens',
    fr: '🔄 Échanger des Tokens',
    de: '🔄 Token Tauschen',
    it: '🔄 Scambia Token',
    pt: '🔄 Trocar Tokens',
    ru: '🔄 Обменять Токены',
    zh: '🔄 交换代币',
    ja: '🔄 トークンを交換',
    ko: '🔄 토큰 교환'
  },

  // Settings
  settings_title: {
    en: '⚙️ Bot Settings',
    es: '⚙️ Configuración del Bot',
    fr: '⚙️ Paramètres du Bot',
    de: '⚙️ Bot-Einstellungen',
    it: '⚙️ Impostazioni del Bot',
    pt: '⚙️ Configurações do Bot',
    ru: '⚙️ Настройки Бота',
    zh: '⚙️ 机器人设置',
    ja: '⚙️ ボット設定',
    ko: '⚙️ 봇 설정'
  },

  settings_subtitle: {
    en: 'Configure your bot preferences:',
    es: 'Configura las preferencias de tu bot:',
    fr: 'Configurez les préférences de votre bot :',
    de: 'Konfigurieren Sie Ihre Bot-Einstellungen:',
    it: 'Configura le preferenze del tuo bot:',
    pt: 'Configure as preferências do seu bot:',
    ru: 'Настройте предпочтения вашего бота:',
    zh: '配置您的机器人偏好：',
    ja: 'ボットの設定を構成します：',
    ko: '봇 설정을 구성하세요:'
  },

  language_settings: {
    en: '🌐 Language Settings',
    es: '🌐 Configuración de Idioma',
    fr: '🌐 Paramètres de Langue',
    de: '🌐 Spracheinstellungen',
    it: '🌐 Impostazioni Lingua',
    pt: '🌐 Configurações de Idioma',
    ru: '🌐 Настройки Языка',
    zh: '🌐 语言设置',
    ja: '🌐 言語設定',
    ko: '🌐 언어 설정'
  },

  notification_settings: {
    en: '🔔 Notification Settings',
    es: '🔔 Configuración de Notificaciones',
    fr: '🔔 Paramètres de Notification',
    de: '🔔 Benachrichtigungseinstellungen',
    it: '🔔 Impostazioni Notifiche',
    pt: '🔔 Configurações de Notificação',
    ru: '🔔 Настройки Уведомлений',
    zh: '🔔 通知设置',
    ja: '🔔 通知設定',
    ko: '🔔 알림 설정'
  },

  trading_defaults: {
    en: '🔄 Trading Defaults',
    es: '🔄 Valores Predeterminados de Comercio',
    fr: '🔄 Valeurs par Défaut de Trading',
    de: '🔄 Handel-Standardwerte',
    it: '🔄 Impostazioni Predefinite Trading',
    pt: '🔄 Padrões de Negociação',
    ru: '🔄 Торговые По умолчанию',
    zh: '🔄 交易默认值',
    ja: '🔄 取引デフォルト',
    ko: '🔄 거래 기본값'
  },

  // Language selection
  language_title: {
    en: '🌐 Language Settings',
    es: '🌐 Configuración de Idioma',
    fr: '🌐 Paramètres de Langue',
    de: '🌐 Spracheinstellungen',
    it: '🌐 Impostazioni Lingua',
    pt: '🌐 Configurações de Idioma',
    ru: '🌐 Настройки Языка',
    zh: '🌐 语言设置',
    ja: '🌐 言語設定',
    ko: '🌐 언어 설정'
  },

  language_subtitle: {
    en: 'Select your preferred language:',
    es: 'Selecciona tu idioma preferido:',
    fr: 'Sélectionnez votre langue préférée :',
    de: 'Wählen Sie Ihre bevorzugte Sprache:',
    it: 'Seleziona la tua lingua preferita:',
    pt: 'Selecione seu idioma preferido:',
    ru: 'Выберите предпочитаемый язык:',
    zh: '选择您偏好的语言：',
    ja: 'お好みの言語を選択してください：',
    ko: '선호하는 언어를 선택하세요:'
  },

  current_language: {
    en: 'Current Language:',
    es: 'Idioma Actual:',
    fr: 'Langue Actuelle :',
    de: 'Aktuelle Sprache:',
    it: 'Lingua Attuale:',
    pt: 'Idioma Atual:',
    ru: 'Текущий Язык:',
    zh: '当前语言：',
    ja: '現在の言語：',
    ko: '현재 언어:'
  },

  // Language names
  language_en: {
    en: '🇺🇸 English',
    es: '🇺🇸 Inglés',
    fr: '🇺🇸 Anglais',
    de: '🇺🇸 Englisch',
    it: '🇺🇸 Inglese',
    pt: '🇺🇸 Inglês',
    ru: '🇺🇸 Английский',
    zh: '🇺🇸 英语',
    ja: '🇺🇸 英語',
    ko: '🇺🇸 영어'
  },

  language_es: {
    en: '🇪🇸 Spanish',
    es: '🇪🇸 Español',
    fr: '🇪🇸 Espagnol',
    de: '🇪🇸 Spanisch',
    it: '🇪🇸 Spagnolo',
    pt: '🇪🇸 Espanhol',
    ru: '🇪🇸 Испанский',
    zh: '🇪🇸 西班牙语',
    ja: '🇪🇸 スペイン語',
    ko: '🇪🇸 스페인어'
  },

  language_fr: {
    en: '🇫🇷 French',
    es: '🇫🇷 Francés',
    fr: '🇫🇷 Français',
    de: '🇫🇷 Französisch',
    it: '🇫🇷 Francese',
    pt: '🇫🇷 Francês',
    ru: '🇫🇷 Французский',
    zh: '🇫🇷 法语',
    ja: '🇫🇷 フランス語',
    ko: '🇫🇷 프랑스어'
  },

  language_de: {
    en: '🇩🇪 German',
    es: '🇩🇪 Alemán',
    fr: '🇩🇪 Allemand',
    de: '🇩🇪 Deutsch',
    it: '🇩🇪 Tedesco',
    pt: '🇩🇪 Alemão',
    ru: '🇩🇪 Немецкий',
    zh: '🇩🇪 德语',
    ja: '🇩🇪 ドイツ語',
    ko: '🇩🇪 독일어'
  },

  language_it: {
    en: '🇮🇹 Italian',
    es: '🇮🇹 Italiano',
    fr: '🇮🇹 Italien',
    de: '🇮🇹 Italienisch',
    it: '🇮🇹 Italiano',
    pt: '🇮🇹 Italiano',
    ru: '🇮🇹 Итальянский',
    zh: '🇮🇹 意大利语',
    ja: '🇮🇹 イタリア語',
    ko: '🇮🇹 이탈리아어'
  },

  language_pt: {
    en: '🇵🇹 Portuguese',
    es: '🇵🇹 Portugués',
    fr: '🇵🇹 Portugais',
    de: '🇵🇹 Portugiesisch',
    it: '🇵🇹 Portoghese',
    pt: '🇵🇹 Português',
    ru: '🇵🇹 Португальский',
    zh: '🇵🇹 葡萄牙语',
    ja: '🇵🇹 ポルトガル語',
    ko: '🇵🇹 포르투갈어'
  },

  language_ru: {
    en: '🇷🇺 Russian',
    es: '🇷🇺 Ruso',
    fr: '🇷🇺 Russe',
    de: '🇷🇺 Russisch',
    it: '🇷🇺 Russo',
    pt: '🇷🇺 Russo',
    ru: '🇷🇺 Русский',
    zh: '🇷🇺 俄语',
    ja: '🇷🇺 ロシア語',
    ko: '🇷🇺 러시아어'
  },

  language_zh: {
    en: '🇨🇳 Chinese',
    es: '🇨🇳 Chino',
    fr: '🇨🇳 Chinois',
    de: '🇨🇳 Chinesisch',
    it: '🇨🇳 Cinese',
    pt: '🇨🇳 Chinês',
    ru: '🇨🇳 Китайский',
    zh: '🇨🇳 中文',
    ja: '🇨🇳 中国語',
    ko: '🇨🇳 중국어'
  },

  language_ja: {
    en: '🇯🇵 Japanese',
    es: '🇯🇵 Japonés',
    fr: '🇯🇵 Japonais',
    de: '🇯🇵 Japanisch',
    it: '🇯🇵 Giapponese',
    pt: '🇯🇵 Japonês',
    ru: '🇯🇵 Японский',
    zh: '🇯🇵 日语',
    ja: '🇯🇵 日本語',
    ko: '🇯🇵 일본어'
  },

  language_ko: {
    en: '🇰🇷 Korean',
    es: '🇰🇷 Coreano',
    fr: '🇰🇷 Coréen',
    de: '🇰🇷 Koreanisch',
    it: '🇰🇷 Coreano',
    pt: '🇰🇷 Coreano',
    ru: '🇰🇷 Корейский',
    zh: '🇰🇷 韩语',
    ja: '🇰🇷 韓国語',
    ko: '🇰🇷 한국어'
  },

  // Success messages
  language_updated: {
    en: '✅ Language updated successfully!',
    es: '✅ ¡Idioma actualizado exitosamente!',
    fr: '✅ Langue mise à jour avec succès !',
    de: '✅ Sprache erfolgreich aktualisiert!',
    it: '✅ Lingua aggiornata con successo!',
    pt: '✅ Idioma atualizado com sucesso!',
    ru: '✅ Язык успешно обновлен!',
    zh: '✅ 语言更新成功！',
    ja: '✅ 言語が正常に更新されました！',
    ko: '✅ 언어가 성공적으로 업데이트되었습니다!'
  },

  // Error messages
  error_language_update: {
    en: '❌ Error updating language:',
    es: '❌ Error al actualizar idioma:',
    fr: '❌ Erreur lors de la mise à jour de la langue :',
    de: '❌ Fehler beim Aktualisieren der Sprache:',
    it: '❌ Errore nell\'aggiornamento della lingua:',
    pt: '❌ Erro ao atualizar idioma:',
    ru: '❌ Ошибка обновления языка:',
    zh: '❌ 更新语言时出错：',
    ja: '❌ 言語の更新エラー：',
    ko: '❌ 언어 업데이트 오류:'
  },

  // Navigation
  back_to_main: {
    en: '🏠 Back to Main Menu',
    es: '🏠 Volver al Menú Principal',
    fr: '🏠 Retour au Menu Principal',
    de: '🏠 Zurück zum Hauptmenü',
    it: '🏠 Torna al Menu Principale',
    pt: '🏠 Voltar ao Menu Principal',
    ru: '🏠 Назад в Главное Меню',
    zh: '🏠 返回主菜单',
    ja: '🏠 メインメニューに戻る',
    ko: '🏠 메인 메뉴로 돌아가기'
  },

  back_to_settings: {
    en: '⚙️ Back to Settings',
    es: '⚙️ Volver a Configuración',
    fr: '⚙️ Retour aux Paramètres',
    de: '⚙️ Zurück zu den Einstellungen',
    it: '⚙️ Torna alle Impostazioni',
    pt: '⚙️ Voltar às Configurações',
    ru: '⚙️ Назад к Настройкам',
    zh: '⚙️ 返回设置',
    ja: '⚙️ 設定に戻る',
    ko: '⚙️ 설정으로 돌아가기'
  },

  // Wallet related
  wallet_locked: {
    en: '🔒 Wallet Locked',
    es: '🔒 Cartera Bloqueada',
    fr: '🔒 Portefeuille Verrouillé',
    de: '🔒 Wallet Gesperrt',
    it: '🔒 Portafoglio Bloccato',
    pt: '🔒 Carteira Bloqueada',
    ru: '🔒 Кошелек Заблокирован',
    zh: '🔒 钱包已锁定',
    ja: '🔒 ウォレットがロックされています',
    ko: '🔒 지갑이 잠겨있습니다'
  },

  wallet_unlock_message: {
    en: 'You need to unlock your wallet first.',
    es: 'Necesitas desbloquear tu cartera primero.',
    fr: 'Vous devez d\'abord déverrouiller votre portefeuille.',
    de: 'Sie müssen zuerst Ihr Wallet entsperren.',
    it: 'Devi prima sbloccare il tuo portafoglio.',
    pt: 'Você precisa desbloquear sua carteira primeiro.',
    ru: 'Сначала нужно разблокировать кошелек.',
    zh: '您需要先解锁钱包。',
    ja: 'まずウォレットのロックを解除する必要があります。',
    ko: '먼저 지갑을 잠금 해제해야 합니다.'
  },

  // Common actions
  cancel: {
    en: '❌ Cancel',
    es: '❌ Cancelar',
    fr: '❌ Annuler',
    de: '❌ Abbrechen',
    it: '❌ Annulla',
    pt: '❌ Cancelar',
    ru: '❌ Отмена',
    zh: '❌ 取消',
    ja: '❌ キャンセル',
    ko: '❌ 취소'
  },

  confirm: {
    en: '✅ Confirm',
    es: '✅ Confirmar',
    fr: '✅ Confirmer',
    de: '✅ Bestätigen',
    it: '✅ Conferma',
    pt: '✅ Confirmar',
    ru: '✅ Подтвердить',
    zh: '✅ 确认',
    ja: '✅ 確認',
    ko: '✅ 확인'
  },

  try_again: {
    en: '🔄 Try Again',
    es: '🔄 Intentar de Nuevo',
    fr: '🔄 Réessayer',
    de: '🔄 Erneut Versuchen',
    it: '🔄 Riprova',
    pt: '🔄 Tentar Novamente',
    ru: '🔄 Попробовать Снова',
    zh: '🔄 重试',
    ja: '🔄 再試行',
    ko: '🔄 다시 시도'
  },

  // Alert related
  alerts_title: {
    en: '🔔 Price Alerts',
    es: '🔔 Alertas de Precio',
    fr: '🔔 Alertes de Prix',
    de: '🔔 Preisalarme',
    it: '🔔 Allerte Prezzi',
    pt: '🔔 Alertas de Preço',
    ru: '🔔 Уведомления о Ценах',
    zh: '🔔 价格警报',
    ja: '🔔 価格アラート',
    ko: '🔔 가격 알림'
  },

  alerts_subtitle: {
    en: 'Manage your price alerts:',
    es: 'Gestiona tus alertas de precio:',
    fr: 'Gérez vos alertes de prix :',
    de: 'Verwalten Sie Ihre Preisalarme:',
    it: 'Gestisci le tue allerte prezzi:',
    pt: 'Gerencie seus alertas de preço:',
    ru: 'Управляйте уведомлениями о ценах:',
    zh: '管理您的价格警报：',
    ja: '価格アラートを管理：',
    ko: '가격 알림 관리:'
  },

  new_alert: {
    en: '➕ New Alert',
    es: '➕ Nueva Alerta',
    fr: '➕ Nouvelle Alerte',
    de: '➕ Neuer Alarm',
    it: '➕ Nuova Allerta',
    pt: '➕ Novo Alerta',
    ru: '➕ Новое Уведомление',
    zh: '➕ 新警报',
    ja: '➕ 新しいアラート',
    ko: '➕ 새 알림'
  },

  my_alerts: {
    en: '📋 My Alerts',
    es: '📋 Mis Alertas',
    fr: '📋 Mes Alertes',
    de: '📋 Meine Alarme',
    it: '📋 Le Mie Allerte',
    pt: '📋 Meus Alertas',
    ru: '📋 Мои Уведомления',
    zh: '📋 我的警报',
    ja: '📋 私のアラート',
    ko: '📋 내 알림'
  },

  alert_settings: {
    en: '⚙️ Alert Settings',
    es: '⚙️ Configuración de Alertas',
    fr: '⚙️ Paramètres d\'Alerte',
    de: '⚙️ Alarm-Einstellungen',
    it: '⚙️ Impostazioni Allerte',
    pt: '⚙️ Configurações de Alerta',
    ru: '⚙️ Настройки Уведомлений',
    zh: '⚙️ 警报设置',
    ja: '⚙️ アラート設定',
    ko: '⚙️ 알림 설정'
  },

  create_alert: {
    en: '🔔 Create New Alert',
    es: '🔔 Crear Nueva Alerta',
    fr: '🔔 Créer une Nouvelle Alerte',
    de: '🔔 Neuen Alarm Erstellen',
    it: '🔔 Crea Nuova Allerta',
    pt: '🔔 Criar Novo Alerta',
    ru: '🔔 Создать Новое Уведомление',
    zh: '🔔 创建新警报',
    ja: '🔔 新しいアラートを作成',
    ko: '🔔 새 알림 만들기'
  },

  enter_token_address: {
    en: 'Please enter the token address you want to set an alert for:',
    es: 'Por favor ingresa la dirección del token para el que quieres configurar una alerta:',
    fr: 'Veuillez entrer l\'adresse du token pour lequel vous voulez définir une alerte :',
    de: 'Bitte geben Sie die Token-Adresse ein, für die Sie einen Alarm einrichten möchten:',
    it: 'Inserisci l\'indirizzo del token per cui vuoi impostare un\'allerta:',
    pt: 'Por favor, insira o endereço do token para o qual deseja configurar um alerta:',
    ru: 'Пожалуйста, введите адрес токена, для которого хотите установить уведомление:',
    zh: '请输入您要设置警报的代币地址：',
    ja: 'アラートを設定したいトークンのアドレスを入力してください：',
    ko: '알림을 설정하려는 토큰 주소를 입력하세요:'
  },

  no_alerts: {
    en: 'You don\'t have any active alerts yet.',
    es: 'Aún no tienes alertas activas.',
    fr: 'Vous n\'avez pas encore d\'alertes actives.',
    de: 'Sie haben noch keine aktiven Alarme.',
    it: 'Non hai ancora allerte attive.',
    pt: 'Você ainda não tem alertas ativos.',
    ru: 'У вас пока нет активных уведомлений.',
    zh: '您还没有任何活动警报。',
    ja: 'まだアクティブなアラートがありません。',
    ko: '아직 활성 알림이 없습니다.'
  },

  back_to_alerts: {
    en: '🏠 Back to Alerts',
    es: '🏠 Volver a Alertas',
    fr: '🏠 Retour aux Alertes',
    de: '🏠 Zurück zu Alarme',
    it: '🏠 Torna alle Allerte',
    pt: '🏠 Voltar aos Alertas',
    ru: '🏠 Назад к Уведомлениям',
    zh: '🏠 返回警报',
    ja: '🏠 アラートに戻る',
    ko: '🏠 알림으로 돌아가기'
  }
};

/**
 * Get translation for a key in the specified language
 * @param key - Translation key
 * @param language - Language code
 * @returns Translated string or key if not found
 */
export function getTranslation(key: string, language: string = 'en'): string {
  const translation = translations[key];
  if (!translation) {
    console.warn(`Translation key not found: ${key}`);
    return key;
  }
  
  const translated = translation[language];
  if (!translated) {
    console.warn(`Translation not found for key: ${key}, language: ${language}`);
    return translation.en || key; // Fallback to English
  }
  
  return translated;
}

/**
 * Get all available languages
 * @returns Array of language codes
 */
export function getAvailableLanguages(): string[] {
  return ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'];
}

/**
 * Get language name for display
 * @param languageCode - Language code
 * @param targetLanguage - Language to display the name in
 * @returns Language name
 */
export function getLanguageName(languageCode: string, targetLanguage: string = 'en'): string {
  const languageKey = `language_${languageCode}`;
  return getTranslation(languageKey, targetLanguage);
}

/**
 * Get translated message for a user based on their language preference
 * @param key - Translation key
 * @param telegramId - User's Telegram ID
 * @returns Promise<string> - Translated message
 */
export async function getTranslatedMessage(key: string, telegramId: string): Promise<string> {
  try {
    const { UserOps } = await import('../database/operations');
    const language = await UserOps.getUserLanguage(telegramId);
    return getTranslation(key, language);
  } catch (error) {
    console.error('Error getting translated message:', error);
    return getTranslation(key, 'en'); // Fallback to English
  }
} 