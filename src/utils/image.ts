type OptimisedImage = {
  data: string
  mimeType: 'image/jpeg'
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Unable to read the image.'))
    reader.readAsDataURL(blob)
  })
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Unable to open the selected image.'))
    }

    image.src = objectUrl
  })
}

export async function optimiseImageForAi(file: File): Promise<OptimisedImage> {
  const image = await loadImage(file)
  const maxDimension = 1600
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Your browser could not prepare the image.')

  context.drawImage(image, 0, 0, width, height)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Unable to prepare the image.'))),
      'image/jpeg',
      0.82,
    )
  })

  const dataUrl = await blobToDataUrl(blob)
  const [, data = ''] = dataUrl.split(',')

  return {
    data,
    mimeType: 'image/jpeg',
  }
}
