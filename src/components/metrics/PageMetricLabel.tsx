import { Icon, Row, Text } from '@formami/react-zen';
import { FilterLink } from '@/components/common/FilterLink';
import { useMessages } from '@/components/hooks';
import { useWebsite } from '@/components/hooks/context/useWebsite';
import { ExternalLink } from '@/components/icons';
import { getPageLink, getPageLinkOptions } from '@/lib/page-link';

export function PageMetricLabel({ type, label }: { type: string; label: string }) {
  const website = useWebsite();
  const { t, labels } = useMessages();
  const origins = website?.pageOrigins || website?.domain;
  const target = getPageLink(origins, label);
  const options = getPageLinkOptions(origins, label);
  return (
    <Row alignItems="center" gap>
      {type === 'fullPath' ? (
        <Text title={label}>{label || `(${t(labels.unknown)})`}</Text>
      ) : (
        <FilterLink type="path" value={label} label={!label ? t(labels.unknown) : undefined} />
      )}
      {options.length ? (
        options.map(url => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`${t('formami.openPage')}: ${url}`}
            title={url}
          >
            <Icon color="muted">
              <ExternalLink />
            </Icon>
            {options.length > 1 && new URL(url).host}
          </a>
        ))
      ) : label ? (
        <Text
          color="muted"
          title={t(`formami.${target.reason}`)}
          aria-label={t(`formami.${target.reason}`)}
        >
          —
        </Text>
      ) : null}
    </Row>
  );
}
