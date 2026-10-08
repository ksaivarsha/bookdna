import { WarmMist } from './WarmMist'

// In the parchment design, most atmosphere comes from CSS on the page wrapper.
// BackgroundLayer only manages the warm mist animation layer.
export function BackgroundLayer() {
  return <WarmMist />
}
