# v0.5 배포 검증 — 2026-10-29

## 실제 배포 완료

- 기능 commit: `edaa5f6cef04b45e28782ef2af31fd20182bb980`
- Edge pin commit: `57e65d1a53113f03eee1b17056ba96a5ab918379`
- PR #1 main 병합/웹 배포 commit: `7fb851b3a58b3f1b0a59435dd43547d10e33dfd6`
- Supabase `family-action` v5 ACTIVE, verify_jwt=true. 공유 도메인 규칙은 위 기능 commit에 고정.
- GitHub Pages build/deploy 모두 성공: https://github.com/herothgf-cell/Good/actions/runs/40806271921
- 전체 PR 검사 성공: https://github.com/herothgf-cell/Good/actions/runs/40805735191
- pin 갱신 후 재검사 성공: https://github.com/herothgf-cell/Good/actions/runs/40805997537
- 실제 서버 접근 경계 검사 성공: https://github.com/herothgf-cell/Good/actions/runs/40806170170
- 앱 주소: https://herothgf-cell.github.io/Good/

## 확인한 검사

GitHub의 전체 Node 자동 검사 187개, TypeScript 검사, 빌드, 새 Chromium 화면 시나리오 31개 그룹, 별도 PostgreSQL 데이터베이스 검사가 모두 통과했습니다. 로컬 복원 작업본은 126개 자동 검사였고 전체 저장소 범위 187개는 GitHub에서 확인했습니다.

반응형 검사는 360/390/430/768/1440px의 보호자·아이 각 5개 주요 화면, 총 50개 조합입니다. 가로 넘침 없음, 보상 편집 아이콘/가격 입력칸 정렬 및 높이 일치, 아이콘 터치 영역 44px 이상을 확인했습니다. 홈 편지 본문 20px과 첫 화면 배치를 실측했습니다. 팝업 초점 가두기, Esc로 아이콘 창만 닫기, 편집 중 값 보존, 미저장 변경 취소도 확인했습니다.

실제 브라우저 화면 캡처는 테스트용 예시 기록으로 실행한 것입니다. 운영 가족 계정을 로그인하거나 가짜 칭찬·쿠폰을 지급하지 않았습니다. 운영 상태를 읽기 전용으로 전후 비교한 결과 가족 데이터 지문이 동일했습니다. 개인정보나 실제 원장 내용은 이 공개 문서에 남기지 않습니다.

## 알려진 검증 한계

- 실제 아이폰/아이패드 Safari 및 안드로이드 기기의 키보드·홈 화면 앱을 직접 조작한 검증은 아닙니다.
- 실제 사용자 인증 후 두 물리적 기기의 신규 거래는 실행하지 않았습니다. CAS/권한/읽음 병합은 자동 검사로 검증했습니다.
- 루트 글꼴 200% 변경은 실제 브라우저 200% 확대 또는 OS 접근성 인증을 뜻하지 않습니다.
- 외부 github.io 직접 브라우징 대신 Pages 성공 기록과 동일 소스 로컬 렌더링을 배포 증거로 사용했습니다.
- 새 편지 알림은 앱 내부 갱신/표시이며 OS 푸시가 아닙니다. 오래된 편지도 첫 도입 때 읽음 기록이 없으면 새 편지로 표시될 수 있습니다.
- 단순 별 직접 지급은 별 원장에 기록됩니다. 칭찬 편지는 일반 칭찬 또는 행동 칭찬 지급 때 생성됩니다.

## 사용 안내

`docs/technical/FAMILY_EXPERIENCE_V05.md` 참고. 기존 계정·기기 연결·별·쿠폰을 다시 만들 필요가 없습니다. 이전 화면이 남으면 앱/탭을 닫고 다시 열거나 새로고침하세요. 브라우저 저장 데이터 삭제는 아이 기기의 로그인을 해제할 수 있으므로 필요하지 않습니다.
