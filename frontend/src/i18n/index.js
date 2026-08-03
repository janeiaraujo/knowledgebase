import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import pt from './locales/pt.json';
import en from './locales/en.json';

// i18n para a interface (PT/EN). Não cobre o conteúdo dos KBs em si (esses
// ficam no idioma em que foram escritos) nem, por enquanto, o backend
// (mensagens de erro da API continuam em PT) - ver README para o roadmap.
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: pt },
      en: { translation: en }
    },
    fallbackLng: 'pt',
    supportedLngs: ['pt', 'en'],
    detection: {
      // Prioriza a escolha explícita do usuário (localStorage); só cai para
      // o idioma do navegador na primeira visita.
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'language',
      caches: ['localStorage']
    },
    interpolation: {
      escapeValue: false // React já escapa por padrão
    }
  });

export default i18n;
