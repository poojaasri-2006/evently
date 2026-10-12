import { useEffect, useState } from 'react';
import { subscribeApiUpdates } from './api';
export const useApiRevision = (paths, token) => {
  const [revision, setRevision] = useState(0);
  const pathKey = paths.join('|');
  useEffect(() => subscribeApiUpdates(update => {
    if (update.authorization === (token ? 'Bearer ' + token : '') && pathKey.split('|').some(path => update.path === '/api/' + path || update.path.startsWith('/api/' + path + '/'))) setRevision(value => value + 1);
  }), [pathKey, token]);
  return revision;
};
