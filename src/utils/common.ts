/**
 * Common utility functions
 */

// Evaluate dynamic function strings (used for imagery provider configs)
export function evil(fn: string): unknown {
  const Fn = Function
  return new Fn('return ' + fn)()
}

// Get URL query parameter
export function getUrlKey(name: string, url: string): string | null {
  return (
    decodeURIComponent(
      (new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(url) || [
        null,
        '',
        null,
      ])[1].replace(/\+/g, '%20')
    ) || null
  )
}

// Get formatted URL parameter
export function getUrlParma(p: string, type = 'string'): unknown {
  let UrlParma: string | null = getUrlKey(p, window.location.href)
  if (type === 'int' && UrlParma) {
    return parseInt(UrlParma)
  }
  if (type === 'float' && UrlParma) {
    return parseFloat(UrlParma)
  }
  if (UrlParma && type === 'array') {
    const parts = UrlParma.split(',')
    return [parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2])]
  }
  return UrlParma
}
