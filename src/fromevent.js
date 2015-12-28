import Rx from 'rx-dom'

const disposableCreate = Rx.Disposable.create
const CompositeDisposable = Rx.CompositeDisposable
const AnonymousObservable = Rx.AnonymousObservable

function createListener({element, eventName, handler, useCapture}) {
  if (element.instance && element.instance.addEventListener) {
    //console.log(`Adding event listener: ${eventName}`)
    //console.log(element)
    element.instance.addEventListener(eventName, handler)
    return disposableCreate(function removeEventListener() {
      //console.log("eventListener disposable called: ", eventName)
      element.instance.removeEventListener(eventName, handler)
    })
  }

  throw new Error(`No instance or listener found`)

}

function createEventListener({element, eventName, handler}) {
  const disposables = new CompositeDisposable()

  const toStr = Object.prototype.toString
  let elementToString = toStr.call(element)
  //console.log(toStr.call(element))
  if (elementToString === `[object NodeList]` ||
    elementToString === `[object HTMLCollection]`)
  {
    for (let i = 0, len = element.length; i < len; i++) {
      disposables.add(createEventListener({
          element: element.item(i),
          eventName,
          handler}))
    }
  } else if(elementToString === `[object Array]`) {
    for (let i = 0, len = element.length; i < len; i++) {
      disposables.add(createEventListener({
          element: element[i],
          eventName,
          handler}))
    }
  }
  else if (element) {
    disposables.add(createListener({element, eventName, handler}))
  }
  return disposables
}

export function fromEvent(element, eventName) {
  //console.log("fromEvent...")
  //console.log(element)
  return new AnonymousObservable(function subscribe(observer) {
    return createEventListener({
      element,
      eventName,
      handler: function handler() {
        observer.onNext(arguments[0])
      }
    })
  }).share()
}
