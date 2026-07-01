# 집 PC 컨트롤

S24에서 버튼 하나로 S21 MacroDroid Webhook을 실행하고, 집 데스크탑을 Wake-on-LAN으로 켠 뒤 Chrome 원격 데스크톱으로 접속하기 위한 PWA입니다.

## 파일 구성

- `index.html`
- `style.css`
- `app.js`
- `manifest.json`
- `sw.js`
- `icon-192.png`
- `icon-512.png`

## 사용 흐름

1. S21은 집 와이파이와 충전기에 연결
2. S21 MacroDroid에서 Webhook 트리거 + Wake On Lan 위젯 클릭 매크로 유지
3. S24에서 이 앱 실행
4. `PC 켜기` 버튼 클릭
5. 30~60초 후 `원격 접속` 버튼 클릭
6. Chrome 원격 데스크톱 접속

## 보안 주의

MacroDroid Webhook URL을 코드에 직접 넣지 마세요.
앱의 설정 화면에서 저장하면 S24 브라우저의 localStorage에만 저장됩니다.


## v2 변경사항

- MacroDroid 웹훅 실행 방식을 선택할 수 있습니다.
- 기본값은 `새 탭으로 열기`입니다. S24 브라우저에서 직접 URL을 눌렀을 때만 웹훅이 먹는 환경을 해결하기 위한 방식입니다.
- 이전 버전 캐시 문제를 피하기 위해 서비스워커 캐시 버전을 v2로 올렸습니다.
