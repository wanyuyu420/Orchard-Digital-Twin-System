/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Baidu Maps Imagery Provider for Cesium
 * Extends WebMercatorTilingScheme to support Baidu tile coordinate system
 */

declare const Cesium: any

function BaiduImageryProvider(this: any, options: { url: string }) {
  this._errorEvent = new Cesium.Event()
  this._tileWidth = 256
  this._tileHeight = 256
  this._maximumLevel = 18
  this._minimumLevel = 1
  const southwestInMeters = new Cesium.Cartesian2(-33554054, -33746824)
  const northeastInMeters = new Cesium.Cartesian2(33554054, 33746824)
  this._tilingScheme = new Cesium.WebMercatorTilingScheme({
    rectangleSouthwestInMeters: southwestInMeters,
    rectangleNortheastInMeters: northeastInMeters,
  })
  this._rectangle = this._tilingScheme.rectangle
  this._resource = Cesium.Resource.createIfNeeded(options.url)
  this._tileDiscardPolicy = undefined
  this._credit = undefined
  this._readyPromise = undefined
}

Object.defineProperties(BaiduImageryProvider.prototype, {
  url: {
    get: function (this: any) {
      return this._resource.url
    },
  },
  proxy: {
    get: function (this: any) {
      return this._resource.proxy
    },
  },
  tileWidth: {
    get: function (this: any) {
      if (!this.ready) {
        throw new Cesium.DeveloperError(
          'tileWidth must not be called before the imagery provider is ready.'
        )
      }
      return this._tileWidth
    },
  },
  tileHeight: {
    get: function (this: any) {
      if (!this.ready) {
        throw new Cesium.DeveloperError(
          'tileHeight must not be called before the imagery provider is ready.'
        )
      }
      return this._tileHeight
    },
  },
  maximumLevel: {
    get: function (this: any) {
      if (!this.ready) {
        throw new Cesium.DeveloperError(
          'maximumLevel must not be called before the imagery provider is ready.'
        )
      }
      return this._maximumLevel
    },
  },
  minimumLevel: {
    get: function (this: any) {
      if (!this.ready) {
        throw new Cesium.DeveloperError(
          'minimumLevel must not be called before the imagery provider is ready.'
        )
      }
      return this._minimumLevel
    },
  },
  tilingScheme: {
    get: function (this: any) {
      if (!this.ready) {
        throw new Cesium.DeveloperError(
          'tilingScheme must not be called before the imagery provider is ready.'
        )
      }
      return this._tilingScheme
    },
  },
  tileDiscardPolicy: {
    get: function (this: any) {
      if (!this.ready) {
        throw new Cesium.DeveloperError(
          'tileDiscardPolicy must not be called before the imagery provider is ready.'
        )
      }
      return this._tileDiscardPolicy
    },
  },
  rectangle: {
    get: function (this: any) {
      if (!this.ready) {
        throw new Cesium.DeveloperError(
          'rectangle must not be called before the imagery provider is ready.'
        )
      }
      return this._rectangle
    },
  },
  errorEvent: {
    get: function (this: any) {
      return this._errorEvent
    },
  },
  ready: {
    get: function (this: any) {
      return this._resource
    },
  },
  readyPromise: {
    get: function (this: any) {
      return this._readyPromise
    },
  },
  credit: {
    get: function (this: any) {
      if (!this.ready) {
        throw new Cesium.DeveloperError(
          'credit must not be called before the imagery provider is ready.'
        )
      }
      return this._credit
    },
  },
})

BaiduImageryProvider.prototype.requestImage = function (
  this: any,
  x: number,
  y: number,
  level: number
) {
  const xTileCount = this._tilingScheme.getNumberOfXTilesAtLevel(level)
  const yTileCount = this._tilingScheme.getNumberOfYTilesAtLevel(level)
  const url = this.url
    .replace('{x}', String(x - xTileCount / 2))
    .replace('{y}', String(yTileCount / 2 - y - 1))
    .replace('{z}', String(level))
    .replace('{s}', String(Math.floor(10 * Math.random())))
  return Cesium.ImageryProvider.loadImage(this, url)
}

// Register to Cesium global
Cesium.BaiduImageryProvider = BaiduImageryProvider

export function init(): void {
  console.log('BaiduImageryProvider initialized')
}

export { BaiduImageryProvider }
