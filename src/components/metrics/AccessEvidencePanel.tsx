import { useState } from 'react';
import { LoadingPanel } from '@/components/common/LoadingPanel';
import { Panel } from '@/components/common/Panel';
import { useApi, useDateParameters, useMessages } from '@/components/hooks';
import { accessActors, accessKinds, accessPurposes } from '@/lib/access-evidence';

export function AccessEvidencePanel({ websiteId }: { websiteId: string }) {
  const { t } = useMessages();
  const { get, useQuery } = useApi();
  const { startAt, endAt } = useDateParameters();
  const [open, setOpen] = useState(false);
  const [actor, setActor] = useState('');
  const [purpose, setPurpose] = useState('');
  const [kind, setKind] = useState('');
  const query = {
    startAt,
    endAt,
    ...(actor && { actor }),
    ...(purpose && { purpose }),
    ...(kind && { kind }),
  };
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['access-evidence', websiteId, query],
    queryFn: () => get(`/websites/${websiteId}/access-evidence`, query),
    enabled: open && !!websiteId,
  });
  return (
    <Panel>
      <details onToggle={event => setOpen(event.currentTarget.open)}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          {t('formami.accessEvidence')}
        </summary>
        <p>{t('formami.evidenceBoundary')}</p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '16px 0' }}>
          {(
            [
              ['actor', actor, setActor, accessActors],
              ['purpose', purpose, setPurpose, accessPurposes],
              ['kind', kind, setKind, accessKinds],
            ] as const
          ).map(([name, value, setter, options]) => (
            <label key={name}>
              {t(`formami.${name}`)}{' '}
              <select value={value} onChange={event => setter(event.target.value)}>
                <option value="">{t('formami.all')}</option>
                {options.map(option => (
                  <option key={option} value={option}>
                    {t(`formami.${option}`)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {open && (
          <LoadingPanel data={data} isLoading={isLoading} error={error}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {accessKinds.map(item => (
                <strong key={item}>
                  {t(`formami.${item}`)}: {data?.totals?.[item] ?? 0}
                </strong>
              ))}
            </div>
            {data?.groups?.length ? (
              <div style={{ overflowX: 'auto', marginTop: 16 }}>
                <table
                  style={{
                    width: '100%',
                    minWidth: '1000px',
                    whiteSpace: 'nowrap',
                    textAlign: 'start',
                    borderSpacing: '12px',
                  }}
                >
                  <thead>
                    <tr>
                      {['content', 'kind', 'actor', 'purpose', 'evidence', 'outcome', 'count'].map(
                        key => (
                          <th key={key}>{t(`formami.${key}`)}</th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.groups.map((row: any) => (
                      <tr key={JSON.stringify(row)}>
                        <td>{row.contentKey}</td>
                        <td>{t(`formami.${row.kind}`)}</td>
                        <td>{t(`formami.${row.actor}`)}</td>
                        <td>{t(`formami.${row.purpose}`)}</td>
                        <td title={`${row.source} / ${row.provider} / ${row.ruleVersion}`}>
                          {t(`formami.${row.evidence}`)} · {t(`formami.${row.confidence}`)}
                        </td>
                        <td>{t(`formami.${row.outcome}`)}</td>
                        <td>{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>{t('formami.noEvidence')}</p>
            )}
            {data?.truncated && <p>{t('formami.truncated')}</p>}
          </LoadingPanel>
        )}
      </details>
    </Panel>
  );
}
