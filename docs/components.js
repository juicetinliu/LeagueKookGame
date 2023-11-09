const HtmlTypes = {
    CLASS: "CLASS",
    ID: "ID"
};

//helper function to create element with id and class on one line
export function documentCreateElement(elementType, id = null, classes = null) {
    let element = document.createElement(elementType);
    if(id) element.id = id;
    if(classes) {
        if(Array.isArray(classes)) {
            classes.forEach(c => element.classList.add(c));
        } else {
            element.classList.add(classes);
        }
    }
    return element;
}

export class Element { //Any element that exists in HTML
    constructor(type, label) {
        this.type = this.getType(type);
        this.label = label;

        this.HIDE_CLASS = "hide";
    }

    getType(type) {
        if(type === "class") {
            return HtmlTypes.CLASS;
        } else if(type === "id") {
            return HtmlTypes.ID;
        } else {
            throw new Error("Invalid element type");
        }
    }

    getElement() {
        if(this.type === HtmlTypes.CLASS) {
            return document.getElementsByClassName(this.label);
        } else if(this.type === HtmlTypes.ID) {
            return document.getElementById(this.label);
        }
        throw new Error("Shouldn't reach this in getElement()");
    }

    addEventListener(events, func) {
        let elementExists = this.exists();
        if(elementExists) {
            if(!Array.isArray(events)) throw new Error("events should be an Array");

            events.forEach(e => {
                if(this.type === HtmlTypes.CLASS) {
                    Array.from(elementExists).forEach(el => {
                        el.addEventListener(e, func);
                    });
                } else if(this.type === HtmlTypes.ID) {
                    elementExists.addEventListener(e, func);
                }
            })
        } else {
            this.throwNotFoundError();
        }
    }

    hide() {
        let elementExists = this.exists();
        if(elementExists) {
            if(this.type === HtmlTypes.CLASS) {
                Array.from(elementExists).forEach(el => {
                    el.classList.add(this.HIDE_CLASS);
                });
            } else if(this.type === HtmlTypes.ID) {
                elementExists.classList.add(this.HIDE_CLASS);
            }
        } else {
            this.throwNotFoundError();
        }
    }

    delete() {
        let elementExists = this.exists();
        if(elementExists) {
            if(this.type === HtmlTypes.CLASS) {
                Array.from(elementExists).forEach(el => {
                    el.remove();
                });
            } else if(this.type === HtmlTypes.ID) {
                elementExists.remove();
            }
        } else {
            this.throwNotFoundError();
        }
    }

    removeChildren() {
        let elementExists = this.exists();
        if(elementExists) {
            if(this.type === HtmlTypes.CLASS) {
                throw new Error("removeChildren not compatible with class element " + this.label);
            }
            while (elementExists.firstChild) {
                elementExists.removeChild(elementExists.firstChild);
            }
        } else {
            this.throwNotFoundError();
        }
    }

    appendChild(child) {
        let elementExists = this.exists();
        if(elementExists) {
            if(this.type === HtmlTypes.CLASS) {
                throw new Error("removeChildren not compatible with class element " + this.label);
            }
            elementExists.appendChild(child);
        } else {
            this.throwNotFoundError();
        }
    }

    show() {
        let elementExists = this.exists();
        if(elementExists) {
            if(this.type === HtmlTypes.CLASS) {
                Array.from(elementExists).forEach(el => {
                    el.classList.remove(this.HIDE_CLASS);
                });
            } else if(this.type === HtmlTypes.ID) {
                elementExists.classList.remove(this.HIDE_CLASS);
            }
        } else {
            this.throwNotFoundError();
        }
    }

    exists() { //return element if it exists otherwise false
        let element = this.getElement();
        if(element) {
            return element;
        } else {
            return false;
        }
    }

    throwNotFoundError() { 
        throw new Error("Element " + this.label + " not found")
    }
}

export class Component extends Element{ //reusable, functional, and created elements
    constructor(type, label, page, app) {
        super(type, label);
        this.app = app;
        this.page = page;
        this.setupCompleted = false;
        this.createCompleted = false;
    }

    create() {
        this.createCompleted = true;
    }

    setup() {
        this.setupCompleted = true;
    } //prevent multiple event listeners attaching
}