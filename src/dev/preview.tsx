import { createRoot } from 'react-dom/client';
import '../renderer/styles.css';
import templateRaw from '../../fixtures/template-v3.json?raw';
import syntheticRaw from '../../fixtures/legacy-synthetic-v3.json?raw';
import { migrate } from '../migrate/migrate';
import { dataUrlResolver } from '../renderer/dataUrlResolver';
import { Site } from '../renderer/Site';
import type { Lang } from '../renderer/context';

const q = new URLSearchParams(location.search);
const raw = q.get('fixture') === 'synthetic' ? syntheticRaw : templateRaw;
const v3: unknown = JSON.parse(raw);
const { data, assets } = migrate(v3);
const route = q.get('route') ?? '';
const lang: Lang = q.get('lang') === 'en' ? 'en' : 'pt';

const root = document.getElementById('root');
if (!root) throw new Error('#root ausente');
createRoot(root).render(<Site data={data} resolveAsset={dataUrlResolver(assets)} initialRoute={route} initialLang={lang} />);
