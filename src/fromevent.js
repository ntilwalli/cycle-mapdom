import xs from 'xstream'

class CompositeProducer {
  constructor() {
    this._disposables = []
  }

  add(disposer) {
    this._disposables.push(disposer)
  }

  start(listener) {
    this._disposables.forEach(producer => producer.start(listener))
  }

  stop() {
    this._disposables.forEach(producer => producer.stop())
    this._disposables = []
  }
}

function createProducer(element, eventName, handler) {
  if (element.instance && element.instance.addEventListener) {
    //console.log(`Adding event listener: ${eventName}`)
    //console.log(element)
    return {
      start: () => {
        element.instance.addEventListener(eventName, handler)
      },
      stop: () => {
        element.instance.removeEventListener(eventName, handler)
      }
    }
  }

  throw new Error(`No instance or listener found`)

}

function createEventProducer(element, eventName, handler) {
  const producer = new CompositeProducer()

  const toStr = Object.prototype.toString
  let elementToString = toStr.call(element)
  //console.log(toStr.call(element))
  if (elementToString === `[object NodeList]` ||
    elementToString === `[object HTMLCollection]`)
  {
    for (let i = 0, len = element.length; i < len; i++) {
      producer.add(createProducer(
          element.item(i),
          eventName,
          handler))
    }
  } else if(elementToString === `[object Array]`) {
    for (let i = 0, len = element.length; i < len; i++) {
      producer.add(createProducer(
          element[i],
          eventName,
          handler))
    }
  }
  else if (element) {
    producer.add(createProducer(element, eventName, handler))
  }

  return producer
}

export default function fromMapboxEvent(element, eventName) {
  //console.log("fromEvent...")
  //console.log(element)

  return xs.create({
    element: element,
    eventName: eventName,
    next: null,
    producer: null,
    start: function start(listener) {
      this.next = function next(event) { listener.next(event); };
      this.producer = createEventProducer(this.element, this.eventName, this.next)
      this.producer.start()
    },
    stop: function stop() {
      if (this.producer) this.producer.stop()
    }
  })
}
