/********************************************************************************
 * Copyright (c) 2022 Contributors to the Eclipse Foundation
 *
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Apache License, Version 2.0 which is available at
 * https://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ********************************************************************************/

const getNodeOrViewable = (c) => c.hasOwnProperty('view') ? c.view : c

const getTextNode = (c, tc) => document.createTextNode(tc === 'string' ? c : '' + c)

const append = (n, c) => {
    if (!(c instanceof Array)) c = [c]
    for (let i in c) {
        const tc = typeof c[i]
        if (tc !== 'undefined')
            try {
                n.appendChild(
                    tc === 'object'
                        ? getNodeOrViewable(c[i])
                        : getTextNode(c[i], tc)
                )
            } catch (e) {
                const pre = document.createElement('pre')
                pre.appendChild(document.createTextNode(JSON.stringify(c[i], null, 4)))
                n.appendChild(pre)
            }
    }
    return n
}

const N = (tag, c, att) => {
    const n = document.createElement(tag)
    if (att) for (let a of Object.keys(att)) n.setAttribute(a, att[a])
    if (typeof c === 'undefined' || c === null || c === false) return n
    return append(n, c)
}
const SEARCH_VALIDATION_REGEX =
    /^[a-zA-ZÀ-ÿŚął\d][a-zA-ZÀ-ÿŚął\d !#'$@&%()*+,\-_./:;=<>?[\]\\^]{0,255}$/

const remove = (n) => n.parentElement.removeChild(n)

const clear = (n) => {
    if (!n) return
    while (n.childNodes.length > 0) n.removeChild(n.firstChild)
    return n
}

const addEvents = (node, evts) => {
    Object.keys(evts).forEach((key) => node.addEventListener(key, evts[key]))
    return node
}

const escapeNames = (string) => string
    .split('\n')
    .map(line => line.match(/^\s+"name": "/)
        ? `"name": "${line.trim().substring(9, line.trim().length - 2).replaceAll('"', "\\\"")}",`
        : line
    )
    .join('\n')

const getSelectedIDP = (providers) => {
    let idp
    try {
        const params = new URLSearchParams(location.search)
        const redURI = params.get('redirect_uri')
        const redParams = new URLSearchParams(redURI.replace(/^[^?]+/, ''))
        const alias = redParams.get('with_idp')
        idp = providers.filter(p => p.alias === alias)[0].name
    } catch (e) {
    }
    return idp || localStorage.getItem('IDP') || ''
}

function debounce(func, timeout = 220) {
    let timer
    return (...args) => {
        clearTimeout(timer)
        timer = setTimeout(() => func.apply(this, args), timeout)
    }
}

const processChange = debounce((e) => Selector.filter(e))

class Viewable {
    getView() {
        return this.view
    }

    append(p) {
        this.getView().appendChild(p instanceof HTMLElement ? p : p.getView())
        return this
    }

    appendTo(p) {
        (p instanceof HTMLElement ? p : p.getView()).appendChild(this.getView())
        return this
    }
}

class SearchInput extends Viewable {

    constructor(providers) {
        super()
        this.input = addEvents(
            N('input', null, {
                type: 'search',
                class: 'search',
                placeholder: 'Enter your company name',
                value: getSelectedIDP(providers),
            }),
            {
                keyup: (e) => processChange(e.target.value),
                search: (e) => processChange(e.target.value),
            }
        )
        this.view = N('div', this.input, { class: 'search-container' })
        this.view.firstChild.select()
    }

    focus() {
        this.input.focus()
        return this
    }
}

class SelectProvider extends Viewable {
    constructor(providers) {
        super()
        this.providers = providers
        this.view = N('div')
    }

    displayError(expr) {
        this.view.appendChild(
            N(
                'div',
                [
                    N('p', 'No results found for', { class: 'error-main' }),
                    N('p', `"${expr}"`, { class: 'error-subtitle' }),
                    N('p', 'Please check your entry for typing errors.', {
                        class: 'error-subtitle-2',
                    }),
                    addEvents(
                        N('button', [N('span', 'Show '), 'list of all companies again'], {
                            class: 'error-button',
                        }),
                        {
                            click: () => {
                                clear(this.view)
                                this.appendSearchResult(this.providers)
                            },
                        }
                    ),
                ],
                { class: 'error-container' }
            )
        )
    }

    appendSearchResult(filteredProviders) {
        this.view.appendChild(
            N(
                'ul',
                filteredProviders.map(
                    (p) =>
                        N(
                            'li',
                            addEvents(
                                N('a', [
                                    N('div', '', { class: `idp-main ${p.alias.replace(/-/g, '_')}` }),
                                    N('div', p.name, { class: 'idp-name' }),
                                ], {
                                    href: p.url.match(/^https?:\/\//)
                                        ? p.url
                                        : `${location.origin}${p.url}`,
                                }),
                                {
                                    click: () => {
                                        localStorage.setItem('IDP', p.name)
                                    },
                                }
                            ),
                            { class: 'idp-card' }
                        )
                )
            )
        )
    }

    filter(expr) {
        clear(this.view)

        expr = expr.trim()
        expr = expr || expr === ''
            ? expr.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&')
            : '.'

        if (expr && !SEARCH_VALIDATION_REGEX.test(expr)) {
            this.displayError(expr)
            return this
        }

        const filteredProviders = this.providers.filter((n) =>
            n.name.toLowerCase().match(expr?.toLowerCase())
        )

        if (filteredProviders.length === 0) {
            this.displayError(expr || ' ')
            return this
        }

        this.appendSearchResult(filteredProviders)

        return this
    }
}

class Page extends Viewable {
    constructor() {
        super()
        this.view = document.body
    }
}

class Header extends Viewable {
    constructor() {
        super()
        this.view = N(
            'header',
            [
                N('div', `This is a complete Tractus-X implementation of Release 25-09, but bypassing SD Factory and Clearing House -
  This is NOT a production environment - it is for Testing purposes only`, { class: 'message' }),
                N('div', null, { class: 'logo' }),
                N('div', 'Search and select', { class: 'title' }),
                N('div', 'your company name to login', { class: 'subtitle' }),
                Search.getView()
            ]
        )
    }
}

class Footer extends Viewable {
    constructor() {
        super()
        this.view = N('footer', [
            N('div', '', { class: 'links' }),
            N('div', 'Copyright © Construct-X', { class: 'copy' })
        ])
    }
}

class Main extends Viewable {
    constructor() {
        super()
        this.view = N('main', Selector.getView())
    }
}

let Search
let Selector

window.onload = () => {
    let icon = document.querySelector('link[rel="icon"]');

    if (!icon) {
        icon = document.createElement('link');
        icon.rel = 'icon';
        document.head.appendChild(icon);
    }
    icon.type = 'image/x-icon';
    icon.href = '../login/resources/images/favicon.ico';

    const CX_PROVIDERS = JSON.parse(
        escapeNames(
            [...document.getElementById('providers').childNodes].map(n => n.data).join('')
        )
    ).slice(0, -1)
    while (document.body.childNodes.length > 0) {
        document.body.removeChild(document.body.firstChild)
    }
    Search = new SearchInput(CX_PROVIDERS)
    Selector = new SelectProvider(CX_PROVIDERS)
    new Page()
        .append(new Header())
        .append(new Main())
        .append(new Footer())
    Selector.filter(Search.focus().input.value)
}
