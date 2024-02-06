// @ts-check
export class MainApp extends HTMLElement {

    constructor() {
        super();

    }

    connectedCallback() {
        this.innerHTML = `
        <style>
        </style>

        <h1>WebUSB Broadcast Assistant...</h1>
        <button id='connect'>CONNECT</button>
        `;
    }

}
customElements.define('main-app', MainApp);
