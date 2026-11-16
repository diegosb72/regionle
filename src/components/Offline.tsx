/** Footer line to download every map and install the application, and the notice of a new version. */
import { Check, Download, MonitorDown, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { L } from '../lib/i18n';
import { applyUpdate, clearPack, downloadPack, loadPack, packStatus, promptInstall, useOffline, type Pack, type PackStatus } from '../lib/offline';
import { nf } from '../lib/text';

const mb = (bytes: number): string => `${nf(bytes / 1_048_576, 1)} MB`;

export function OfflineBar() {
  const { supported, installable } = useOffline();
  const [pack, setPack] = useState<Pack | null>(null);
  const [status, setStatus] = useState<PackStatus | null>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [failed, setFailed] = useState(0);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!supported) return;
    let alive = true;
    void loadPack().then(async (p) => {
      if (!alive || !p) return;
      setPack(p);
      const st = await packStatus(p).catch(() => null);
      if (alive) setStatus(st);
    });
    return () => {
      alive = false;
      abort.current?.abort();
    };
  }, [supported]);

  if (!supported && !installable) return null;

  const download = async () => {
    if (!pack || progress) return;
    const ctl = new AbortController();
    abort.current = ctl;
    setFailed(0);
    setProgress([0, pack.files.length]);
    const bad = await downloadPack(pack, (done, total) => setProgress([done, total]), ctl.signal).catch(() => pack.files.length);
    if (ctl.signal.aborted) return;
    setProgress(null);
    setFailed(bad);
    setStatus(await packStatus(pack).catch(() => null));
  };
  const remove = async () => {
    if (!pack) return;
    await clearPack();
    setStatus(await packStatus(pack).catch(() => null));
  };

  const full = status?.kind === 'full';
  return (
    <div className="offline">
      {pack && status && (
        <div className="offline-row">
          <span className="offline-text">
            {progress ? (
              <>
                <b>{L('Descargando los mapas…', 'Downloading the maps…')}</b> {nf(progress[0])} {L('de', 'of')} {nf(progress[1])}
              </>
            ) : full ? (
              <>
                <Check size={15} aria-hidden="true" /> <b>{L('Todo descargado.', 'Everything is downloaded.')}</b> {L('Puedes jugar sin conexión.', 'You can play without a connection.')}
              </>
            ) : failed ? (
              <>
                <b>{L(`No se han podido descargar ${nf(failed)} archivos.`, `${nf(failed)} files could not be downloaded.`)}</b> {L('Comprueba la conexión y vuelve a intentarlo.', 'Check your connection and try again.')}
              </>
            ) : status.kind === 'stale' ? (
              <>
                <b>{L('Hay mapas nuevos.', 'There are new maps.')}</b> {L('Actualiza la descarga para tenerlos sin conexión.', 'Update the download to have them without a connection.')}
              </>
            ) : (
              <>
                <b>{L('¿Sin conexión?', 'No connection?')}</b>{' '}
                {L(
                  `Descarga todos los mapas y banderas (unos ${mb(pack.bytes)}) y Regionle funcionará sin internet.`,
                  `Download every map and flag (about ${mb(pack.bytes)}) and Regionle will work without the internet.`,
                )}
              </>
            )}
          </span>
          {progress ? (
            <progress className="offline-bar" value={progress[0]} max={progress[1]} aria-label={L('Descarga', 'Download')} />
          ) : full ? (
            <button type="button" className="btn btn-xs btn-ghost" onClick={remove} title={L('Libera el espacio que ocupan los mapas', 'Frees the space taken by the maps')}>
              <Trash2 size={13} aria-hidden="true" />
              {L('Borrar', 'Delete')}
            </button>
          ) : (
            <button type="button" className="btn btn-sm" onClick={download}>
              <Download size={15} aria-hidden="true" />
              {failed ? L('Reintentar', 'Retry') : status.kind === 'stale' ? L('Actualizar', 'Update') : L('Descargar todo', 'Download everything')}
            </button>
          )}
        </div>
      )}
      {installable && (
        <div className="offline-row">
          <span className="offline-text">
            <b>{L('Regionle como aplicación.', 'Regionle as an app.')}</b> {L('Se abre en su propia ventana, con su icono.', 'It opens in its own window, with its own icon.')}
          </span>
          <button type="button" className="btn btn-sm" onClick={() => void promptInstall()}>
            <MonitorDown size={15} aria-hidden="true" />
            {L('Instalar', 'Install')}
          </button>
        </div>
      )}
    </div>
  );
}

/** Shown when a new version has been downloaded in the background; nothing changes until the player says so. */
export function UpdateNotice() {
  const { update } = useOffline();
  const [hidden, setHidden] = useState(false);
  if (!update || hidden) return null;
  return (
    <div className="update" role="status">
      <span>
        <b>{L('Hay una versión nueva de Regionle.', 'There is a new version of Regionle.')}</b>
      </span>
      <button type="button" className="btn btn-sm btn-primary" onClick={applyUpdate}>
        <RefreshCw size={15} aria-hidden="true" />
        {L('Actualizar', 'Update')}
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setHidden(true)}>
        {L('Luego', 'Later')}
      </button>
    </div>
  );
}
