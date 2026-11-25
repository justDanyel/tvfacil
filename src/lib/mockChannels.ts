import type { Channel } from './types'

/** Demo channels for offline / first-run demos (Big Buck Bunny / public test streams). */
export const MOCK_CHANNELS: Channel[] = [
  {
    id: 'demo-rtp1',
    name: 'RTP 1 (demo)',
    category: 'Nacionais',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/RTP1_logo_2016.svg/240px-RTP1_logo_2016.svg.png',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  },
  {
    id: 'demo-rtp2',
    name: 'RTP 2 (demo)',
    category: 'Nacionais',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/RTP2_logo_2016.svg/240px-RTP2_logo_2016.svg.png',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
  },
  {
    id: 'demo-sic',
    name: 'SIC (demo)',
    category: 'Nacionais',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/SIC_logo_2018.svg/240px-SIC_logo_2018.svg.png',
    url: 'https://test-streams.mux.dev/test_001/stream.m3u8',
  },
  {
    id: 'demo-tvi',
    name: 'TVI (demo)',
    category: 'Nacionais',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/TVI_logo_2017.svg/240px-TVI_logo_2017.svg.png',
    url: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/teststream/master.m3u8',
  },
  {
    id: 'demo-cnn',
    name: 'Notícias (demo)',
    category: 'Notícias',
    url: 'https://test-streams.mux.dev/pts_shift/master.m3u8',
  },
  {
    id: 'demo-desporto',
    name: 'Desporto (demo)',
    category: 'Desporto',
    url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
  },
  {
    id: 'demo-sporttv',
    name: 'Sport TV 1 (demo)',
    category: 'Desporto',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  },
  {
    id: 'demo-eleven',
    name: 'Eleven Sports (demo)',
    category: 'Desporto',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
  },
  {
    id: 'demo-dazn',
    name: 'DAZN 1 (demo)',
    category: 'Desporto',
    url: 'https://test-streams.mux.dev/pts_shift/master.m3u8',
  },
  {
    id: 'demo-benfica',
    name: 'Benfica TV (demo)',
    category: 'Desporto',
    url: 'https://test-streams.mux.dev/test_001/stream.m3u8',
  },
  {
    id: 'demo-ucl-event',
    name: 'UCL: Sporting CP vs Manchester United',
    category: 'Desporto',
    url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
  },
  {
    id: 'demo-cinema',
    name: 'Cinema (demo)',
    category: 'Cinema',
    url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
  },
  {
    id: 'demo-infantil',
    name: 'Infantil (demo)',
    category: 'Infantil',
    url: 'https://test-streams.mux.dev/dai-discontinuity-deltatimeline/manifest.m3u8',
  },
]
