import {Observable as O} from 'rxjs'
import Cycle from '@cycle/rxjs-run'
import {makeDOMDriver, div} from '@cycle/dom'
import {makeMapDOMDriver} from '../index'
import VirtualDOM from 'virtual-dom'
const VNode = VirtualDOM.VNode

function main(sources) {
    const anchorId = `mapAnchor`
    const centerZoom = {
      center: [40.730610, -73.935242], 
      zoom: 15
    }

    const properties = {
      attributes: {
        class: `selectMap`
      }, 
      centerZoom, 
      disablePanZoom: false, 
      anchorId, 
      mapOptions: {
        zoomControl: true
      }
    }

    const tile = `mapbox.streets`

    const mapvnode = new VNode(`map`, properties, [
      new VNode(`tileLayer`, { tile }),
      new VNode(`marker`, { latLng: centerZoom.center, attributes: {id: `latLngMarker`}}, [
              // new VNode(`divIcon`, {
              //   options: {
              //     iconSize: 80,
              //     iconAnchor: [40, -10],
              //     html: `${event.core.name}`
              //   },
              //   attributes: {id: divIconId}
              // }, [], divIconId)
            ],
            `latLngMarker`)
    ])

  const mapClick$ = sources.MapDOM.chooseMap(anchorId).select(`.selectMap`).events(`click`)
     .map(ev => ev.latlng)
     


  return {
    DOM: mapClick$
     .map(x => JSON.stringify(x))
     .startWith(`blah`)
     .map(x => div([
      div(`#${anchorId}`, []),
      div([x])
    ])),
    MapDOM: O.of(mapvnode)
  }
}

Cycle.run(main, {
  DOM: makeDOMDriver(`#app`),
  MapDOM: makeMapDOMDriver(
    `pk.eyJ1IjoibXJyZWRlYXJzIiwiYSI6ImNpbHJsZnJ3NzA4dHZ1bGtub2hnbGVnbHkifQ.ph2UH9MoZtkVB0_RNBOXwA`
  )
})