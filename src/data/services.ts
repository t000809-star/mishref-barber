import type { Service } from '../types'

export const SERVICES: Service[] = [
  {
    id: 'classic-cut',
    name: 'Classic Cut',
    durationMin: 30,
    priceKwd: 5,
    description: 'Scissor & clipper cut, finished with a hot rinse.',
  },
  {
    id: 'beard-sculpt',
    name: 'Beard Sculpt',
    durationMin: 30,
    priceKwd: 3,
    description: 'Line-up, shape and oil — clean edges, soft finish.',
  },
  {
    id: 'hot-towel-shave',
    name: 'Hot Towel Shave',
    durationMin: 45,
    priceKwd: 4,
    description: 'Steamed towel, straight razor, balm. The full ritual.',
  },
  {
    id: 'the-works',
    name: 'The Works',
    durationMin: 60,
    priceKwd: 10,
    description: 'Cut + beard sculpt + hot towel shave. Walk out new.',
  },
]

export const serviceById = (id: string) => SERVICES.find(s => s.id === id)
