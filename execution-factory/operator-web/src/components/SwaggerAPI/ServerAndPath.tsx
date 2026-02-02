import { useMemo } from 'react';
import classNames from 'classnames';
import { parseUrlFromOpenAPI, parseHttpMethod } from '@/components/API/utils';
import styles from './ServerAndPath.module.less';

interface ServerAndPathProps {
  spec: any;
}

const ServerAndPath = ({ spec }: ServerAndPathProps) => {
  const [url, method] = useMemo(() => [parseUrlFromOpenAPI(spec), parseHttpMethod(spec)], [spec]);
  return (
    <div className={styles['container']}>
      <span className={classNames(styles['http-method'], styles[`http-method-${method.toLowerCase()}`])}>{method}</span>
      <span className={styles['url']} title={url}>
        {url}
      </span>
    </div>
  );
};

export default ServerAndPath;
