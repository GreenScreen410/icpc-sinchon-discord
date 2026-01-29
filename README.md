# ICPC Sinchon Discord Bot (SUAPC)

ICPC Sinchon 출석 체크를 자동화하기 위한 봇입니다.

## 주요 기능

### 자동 출석 체크 시스템 (Google Sheets 연동)

* **스케줄 관리**: 매일 지정된 시간에 음성 채널 입장을 자동으로 확인합니다.
  * **초급 (Novice)**: 오후 3시 10분 (`15:10`)
  * **중급 (Advanced)**: 오후 5시 10분 (`17:10`)
* **분반별 관리**: 각 분반에 지정된 전용 음성 채널 인원만 확인하여 정확도를 높였습니다.
* **시트 자동 업데이트**: 오늘 날짜(`YYYY.M.D`) 컬럼을 자동으로 찾아 출석 시 `1`, 결석 시 `0`을 입력합니다.
* **자동 보고**: 출석 체크 완료 후 지정된 텍스트 채널로 출석 현황(임베드 형태)을 즉시 전송합니다.

## 설치 및 설정

### 필수 요구 사항

* [Bun](https://bun.sh/) 런타임
* Google API 서비스 계정 JSON 키 파일
* Google Sheets (수강생 이름 및 핸들 정보 포함)

### 환경 변수 (.env) 설정

```dotenv
DISCORD_TOKEN=메인_봇_토큰

GUILD_ID=서버_ID
SPREADSHEET_ID=구글_시트_ID

# 알림 및 보고용 텍스트 채널
NOVICE_CHANNEL_ID=초급_보고_채널_ID
NOVICE_VOICE_CHANNEL_ID=초급_음성_채널_ID

# 출석 확인용 음성 채널
ADVANCED_CHANNEL_ID=중급_보고_채널_ID
ADVANCED_VOICE_CHANNEL_ID=중급_음성_채널_ID
```

### 설치 및 실행

```bash
# 의존성 설치
bun install

# 봇 실행
bun start
```

## 시트 구성 가이드

봇이 시트를 올바르게 읽으려면 다음 형식을 준수해야 합니다:

* **A열 (Index 0)**: 수강생 성함
* **D열 (Index 3)**: 디스코드 핸들 (예: `username`)
* **헤더**: '난이도' 혹은 '분반' 컬럼에 `Novice (초급)` 또는 `Advanced (중급)` 텍스트가 포함되어야 합니다.
* **날짜**: 첫 번째 행에 `2026.1.23`과 같은 형식의 날짜 헤더가 있어야 해당 열에 기록됩니다.

## 라이선스

MIT License
