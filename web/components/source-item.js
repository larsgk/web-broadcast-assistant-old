// @ts-check

/*
* Source Item Component
*/

const template = document.createElement('template');
template.innerHTML = `
<style>
/* Styles go here */
div {
	display: block;
	position: relative;
	box-sizing: border-box;
	min-width: 5.14em;
	height: 75px;
	width: 100%;
	margin: 0.2em;
	background: transparent;
	text-align: center;
	border-radius: 5px;
	border: 1px black solid;
	user-select: none;
	cursor: pointer;
	padding: 0.7em 0.57em;
	background-color: var(--background-color, white);
	color: black;
}

#name {
	position: absolute;
	left: 5px;
	top: 5px;
	font-size: 1.2em;
}

#addr {
	position: absolute;
	left: 5px;
	top: 30px;
	font-size: 0.9em;
}

#broadcast_name {
	position: absolute;
	top: 5px;
	font-size: 1.2em;
}

#uuid16s {
	position: absolute;
	left: 5px;
	bottom: 5px;
	font-size: 0.9em;
}

#rssi {
	position: absolute;
	right: 5px;
	bottom: 5px;
	font-size: 0.9em;
}

</style>
<div>
<span id="name"></span>
<span id="broadcast_name"></span>
<span id="addr"></span>
<span id="uuid16s"></span>
<span id="rssi"></span>
</div>
`;

export class SourceItem extends HTMLElement {
	#source
	#nameEl
	#broadcastNameEl
	#addrEl
	#uuid16sEl
	#rssiEl
	
	constructor() {
		super();
		
		const shadowRoot = this.attachShadow({mode: 'open'});
		shadowRoot.appendChild(template.content.cloneNode(true));
	}

	connectedCallback() {
		this.#nameEl = this.shadowRoot?.querySelector('#name');
		this.#broadcastNameEl = this.shadowRoot?.querySelector('#broadcast_name');
		this.#addrEl = this.shadowRoot?.querySelector('#addr');
		this.#uuid16sEl = this.shadowRoot?.querySelector('#uuid16s');
		this.#rssiEl = this.shadowRoot?.querySelector('#rssi');
	}
	
	setModel(source) {
		this.#source = source;

		// Set name (and more...)
		this.#nameEl.textContent = this.#source.name;
		this.#broadcastNameEl.textContent = this.#source.broadcast_name;
		this.#addrEl.textContent = this.#source.addr;
		this.#rssiEl.textContent = `RSSI: ${this.#source.rssi}`;

		this.#uuid16sEl.textContent = `UUID16s: [${this.#source.uuid16s?.map(
			a => {return '0x'+a.toString(16)}
			)} ]`;
	}
}
customElements.define('source-item', SourceItem);
	