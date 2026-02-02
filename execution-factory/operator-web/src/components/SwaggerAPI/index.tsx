import { useEffect, useState, useRef } from 'react';
import { getHttpBaseUrl, getConfig } from '@/utils/http';
import { isEmpty } from 'lodash';
import { Button } from 'antd';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import {
  transformToolInfoToOpenAPI,
  parseQueryParams,
  parseUrlFromOpenAPI,
  parsePathParamsFromUrl,
} from '@/components/API/utils';
import { OperatorTypeEnum } from '@/components/OperatorList/types';
import { debugTool } from '@/apis/agent-operator-integration';
import ServerAndPath from './ServerAndPath';
import styles from './index.module.less';

interface SwaggerAPIProps {
  info: any;
  operatorType: OperatorTypeEnum.MCP | OperatorTypeEnum.Tool | OperatorTypeEnum.Operator;
}

const getDebugUrl = (
  info: any,
  operatorType: OperatorTypeEnum.Tool | OperatorTypeEnum.Tool | OperatorTypeEnum.Operator
) => {
  const httpBaseUrl = getHttpBaseUrl();
  const urls = {
    [OperatorTypeEnum.Tool]: `${httpBaseUrl}/api/agent-operator-integration/v1/tool-box/${info.box_id}/tool/${info.tool_id}/debug`,
    [OperatorTypeEnum.Operator]: `${httpBaseUrl}/api/agent-operator-integration/v1/operator/debug`,
  };

  return urls[operatorType] || '';
};

const CustomLayoutPlugin = () => ({
  wrapComponents: {
    // 自定义 Try-It-Out 按钮组件
    TryItOutButton: (Original, system) => props => {
      const { enabled } = props;
      console.log(111, props, system.getComponents());

      useEffect(() => {
        const container = getConfig('container');
        const element = container.querySelector('.validation-errors.errors-wrapper');
        if (element) {
          element.style.display = 'none';
        }
        if (!enabled) {
          const elements = container.querySelectorAll('.swagger-ui input.invalid');
          elements?.forEach(item => {
            item.removeAttribute('class');
          });

          const element = container.querySelector('.swagger-ui select.invalid');
          if (element) {
            element.removeAttribute('class');
          }

          return;
        }
        const btn = container.querySelector('.execute');
        if (btn) {
          btn.innerHTML = '运行并刷新';
        }
      }, [enabled]);

      return (
        <>
          <Button
            type={enabled ? 'default' : 'primary'}
            style={{
              width: '120px',
              height: '36px',
              fontWeight: '700',
            }}
            onClick={
              enabled
                ? () => {
                    props.onCancelClick();
                    props.onResetClick();
                  }
                : props.onTryoutClick
            }
          >
            {enabled ? '取消' : '调试'}
          </Button>
        </>
      );
    },

    InfoContainer: Original => props => {
      return (
        <>
          <Original {...props} />
          <ServerAndPath spec={JSON.parse(props.spec().get('spec'))} />
        </>
      );
    },

    // Model: (Original, system) => props => {
    //   console.log(222, props, system);
    //   return (
    //     <>
    //       <Original {...props} />
    //       <div>1111</div>
    //     </>
    //   );
    // },
  },
});

const SwaggerAPI = ({ info, operatorType }: SwaggerAPIProps) => {
  const bodyRef = useRef(null);

  const [spec, setSpec] = useState<any | undefined>(undefined);

  useEffect(() => {
    const spec = transformToolInfoToOpenAPI(info);
    if (isEmpty(spec)) {
      return;
    }

    // 先设置undefined，为了让数据清空
    setSpec(undefined);
    setTimeout(() => setSpec(spec));
  }, [info]);

  const handleRequest = req => {
    let body = req.body;
    try {
      body = JSON.parse(req.body);
    } catch {}
    const query = parseQueryParams(req.url);
    const path = parsePathParamsFromUrl(parseUrlFromOpenAPI(spec), req.url);
    const header = req.headers;
    req.body = JSON.stringify({
      ...(isEmpty(body) ? {} : { body }),
      ...(isEmpty(header) ? {} : { header }),
      ...(isEmpty(query) ? {} : { query }),
      ...(isEmpty(path) ? {} : { path }),
    });

    bodyRef.current = req.body;

    req.url = getDebugUrl(info, operatorType);
    req.method = 'POST';
    req.headers = {
      Authorization: 'Bearer ' + getConfig('getToken')(),
    };

    return req;
  };

  const handleResponse = async res => {
    // token失效：刷新token，然后重试
    if (res?.status === 401) {
      await getConfig('refreshToken')();
      let result = await debugTool(info.box_id, info.tool_id, bodyRef.current, { returnFullResponse: true });

      if (result.status < 400) {
        // result.data才是真正的接口返回
        result = result.data;
      }

      if (!result.status) {
        result.status = result.status_code;
      }
      try {
        result.data = JSON.stringify(result.body);
      } catch {}

      result.obj = result.body;
      result.ok = result.status < 400;
      result.text = result.data;

      return result;
    }

    // 其它报错，则直接返回错误信息
    if (!res.ok) return res;

    // 不报错，代表debug接口调用成功，则将res.body作为真正的接口返回
    const result = res.body;
    if (!result.status) {
      result.status = result.status_code;
    }
    try {
      result.data = JSON.stringify(result.body);
    } catch {}
    result.obj = result.body;
    result.text = result.data;

    return result;
  };

  return (
    <div className={styles.container}>
      {Boolean(spec) && (
        <SwaggerUI
          spec={spec}
          docExpansion="full"
          defaultModelExpandDepth={-1}
          plugins={[CustomLayoutPlugin]}
          requestInterceptor={handleRequest}
          responseInterceptor={handleResponse}
        />
      )}
    </div>
  );
};

export default SwaggerAPI;
