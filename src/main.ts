import { defineCustomElement } from 'vue';
import Antd from 'ant-design-vue';
import App from './App.vue';

const CohirerElement = defineCustomElement(App, {
  configureApp: (app) => {
    app.use(Antd);
  },
});

// Register the custom element
customElements.define('er-biz-x', CohirerElement);
