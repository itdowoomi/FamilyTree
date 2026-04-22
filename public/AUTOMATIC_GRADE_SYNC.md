# 자동 등급 계산 및 Recruit-Member 동기화 구현

## 📋 개요
이 문서는 적합도 점수에 따른 자동 등급 계산과 Recruit 리스트와 Member 간의 양방향 동기화 기능을 설명합니다.

## ⚡ 핵심 기능

### 1. 자동 등급 계산 (Automatic Grade Calculation)
적합도 점수에 따라 자동으로 등급이 부여됩니다:

- **Serious (진지한 관심)**: 적합도 ≥ 85점
- **Potential (잠재 관심)**: 적합도 ≥ 60점
- **일반 상태**: 적합도 < 60점 (Recruit만 유지, Member는 제거)

### 2. 양방향 동기화 (Bi-directional Sync)

#### Recruit → Member 동기화
```
Recruit 점수 변경 시:
├─ 점수 ≥ 85 → Serious 멤버 생성/업데이트
├─ 점수 ≥ 60 → Potential 멤버 생성/업데이트
└─ 점수 < 60 → 연결된 Member 삭제 (Recruit는 유지)
```

#### Member → Recruit 동기화
```
Member 점수 변경 시:
├─ 점수 ≥ 85 → Serious 상태로 변경, Recruit 점수 동기화
├─ 점수 ≥ 60 → Potential 상태로 변경, Recruit 점수 동기화
└─ 점수 < 60 → 일반 상태로 변경, Recruit 연결 해제 및 삭제
```

## 🔧 구현 상세

### onScoreChange 함수 (app.js line 1461-1504)
```javascript
function onScoreChange(item, isRecruit = true) {
    // 점수에 따른 자동 등급 계산
    const score = Number(item.score) || 0;
    let newStatus = null;
    
    if (score >= 85) newStatus = 'Serious';
    else if (score >= 60) newStatus = 'Potential';
    
    if (isRecruit) {
        // Recruit 업데이트: 연결된 Member 생성/수정/삭제
        const linkedMember = members.value.find(m => m.recruitId === item.id);
        
        if (newStatus && linkedMember) {
            linkedMember.status = newStatus;
            linkedMember.score = score;
        } else if (newStatus && !linkedMember) {
            // Watch가 자동으로 Member 생성 처리
        } else if (!newStatus && linkedMember) {
            // 점수가 60 미만으로 떨어지면 Member 삭제
            members.value = members.value.filter(m => m.id !== linkedMember.id);
        }
    } else {
        // Member 업데이트: 상태 변경 및 Recruit 동기화
        if (newStatus) {
            item.status = newStatus;
            if (item.recruitId) {
                const r = recruits.value.find(x => x.id === item.recruitId);
                if (r) r.score = score;
            }
        } else if (!newStatus && ['Potential', 'Serious'].includes(item.status)) {
            item.status = 'New(Code-in)';
            if (item.recruitId) {
                recruits.value = recruits.value.filter(r => r.id !== item.recruitId);
                item.recruitId = null;
            }
        }
    }
}
```

### Watch 함수들 (app.js lines 1260-1317)

#### Recruit Watch (lines 1260-1285)
- Recruit 데이터 변경 감지
- 연결된 Member에 모든 필드 동기화 (이름, 전공, 직업, 회사, 관계, 만난 날짜, 생년월일, 나이, 성별, 점수, disposition)

#### Member Watch (lines 1287-1317)
- Member 상태가 Potential/Serious로 변경되면:
  - 기존 Recruit와 연결 또는 새 Recruit 자동 생성
- Member 상태가 일반 상태로 변경되면:
  - Recruit 연결 해제 및 삭제
- 모든 필드를 연결된 Recruit에 동기화

## 📊 기본성향 평가 (Disposition Assessment)

### 평가 항목 및 배점
- **관계 점수**: 1~10점 (직접 입력)
- **Market 크기**:
  - L (Large): 10점
  - M (Medium): 8점
  - S (Small): 6점
- **체크리스트** (각 10점):
  - ✓ 결혼 (married)
  - ✓ 자녀 (child)
  - ✓ 주택 (house)
  - ✓ 인컴 (income)
  - ✓ 야심 (ambition)
  - ✓ 불만족 (dissatisfied)
  - ✓ PMA (긍정적 태도)
  - ✓ 기업가형 (entrepreneur)

**최대 점수**: 10 + 10 + (8×10) = 100점

### calcDisposition 함수 (app.js line 1384)
평가 항목 변경 시 자동으로 총점을 계산하고 `onScoreChange`를 호출하여 등급을 자동 업데이트합니다.

## 🎯 사용 방법

### 시나리오 1: Recruit에서 시작
1. **Recruit 탭**에서 신규 인원 추가 (기본 점수: 50)
2. **기본성향 평가** 버튼 클릭하여 평가 진행
3. 항목 체크 시 점수가 자동 계산됨
4. 점수 ≥ 60: 자동으로 Potential 멤버 생성 (트리에 표시)
5. 점수 ≥ 85: 자동으로 Serious 멤버로 업그레이드
6. **"멤버" 버튼** 클릭: 정식 멤버(New(Code-in))로 승급

### 시나리오 2: Member에서 시작
1. **멤버 정보 탭**에서 기존 멤버의 적합도 입력
2. 점수 입력 또는 기본성향 평가 진행
3. 점수 ≥ 60: 자동으로 Potential 상태로 변경 + Recruit 생성
4. 점수 ≥ 85: 자동으로 Serious 상태로 변경
5. 점수 < 60: 일반 상태로 복귀 + Recruit 삭제

### 시나리오 3: 등급 하향
1. Serious/Potential 멤버의 점수를 60 미만으로 변경
2. 자동으로 일반 상태(New(Code-in))로 변경
3. Recruit 리스트에서 자동 삭제
4. 멤버는 트리에 그대로 유지

## 🔄 동기화되는 필드

### Member ↔ Recruit 양방향 동기화 필드:
- ✅ 이름 (name)
- ✅ 전공 (major)
- ✅ 직업 (job)
- ✅ 회사 (company)
- ✅ 관계 (relation)
- ✅ 만난 날짜 (meetDate)
- ✅ 생년월일 (birthDate)
- ✅ 나이 (age)
- ✅ 성별 (gender)
- ✅ 적합도 점수 (score)
- ✅ 기본성향 평가 (disposition)
- ✅ 상담/관리 기록 (interactionHistory)

### 동기화 예외:
- ❌ 이메일 (email) - Member만 관리
- ❌ 포인트/실적 기록 (history) - Member만 관리
- ❌ 상위 멤버 (parentId) - Member만 관리
- ❌ 작성자 정보 (createdBy, createdByEmail) - Recruit만 관리

## 🎨 시각적 표시

### 트리 노드 스타일
- **Serious**: 밝은 회색 배경 (#e9e7e2), 회색 테두리
- **Potential**: 밝은 회색 배경 (#f8f9fa), 점선 테두리
- **연결선**: Potential/Serious는 점선, 나머지는 실선

### 사이드바 표시
- Recruit 리스트는 점수순으로 정렬
- 점수 바(progress bar) 표시
- 상담 기록은 Member와 실시간 동기화

## ⚠️ 주의사항

1. **삭제 동작**: 
   - Potential/Serious Member 삭제 → Recruit도 함께 삭제
   - Recruit 삭제 → 연결된 Potential/Serious Member도 함께 삭제

2. **승급 동작** (promoteRecruit):
   - Recruit를 "정식 멤버(New(Code-in))"로 승급
   - Recruit 리스트에서 제거됨
   - recruitId 연결 해제
   - 상담 기록은 Member로 이관

3. **점수 변경 시 즉시 반영**:
   - 수동 점수 입력: @change 이벤트로 즉시 처리
   - 기본성향 평가: calcDisposition → onScoreChange 자동 호출
   - 동기화 충돌 방지: syncLock 메커니즘 사용 (100ms)

## 🧪 테스트 시나리오

### 테스트 1: Recruit 점수 증가
1. Recruit 추가 (점수: 50)
2. 점수를 65로 변경 → Potential 멤버 자동 생성 확인
3. 점수를 90으로 변경 → Serious 상태로 변경 확인
4. 트리에 노드가 표시되는지 확인

### 테스트 2: Member 점수 변경
1. 일반 멤버 선택
2. 멤버 정보 탭에서 적합도 70 입력 → Potential 상태 + Recruit 생성 확인
3. 점수를 90으로 변경 → Serious 상태로 변경 확인
4. Recruit 탭에서 해당 인원이 점수 90으로 표시되는지 확인

### 테스트 3: 등급 하향
1. Serious 멤버 선택 (점수: 90)
2. 점수를 55로 변경 → New(Code-in) 상태 + Recruit 삭제 확인
3. 멤버는 트리에 그대로 유지되는지 확인

### 테스트 4: 기본성향 평가
1. Recruit 선택
2. 기본성향 평가 패널 열기
3. 관계: 8점, Market: L(10점), 체크리스트 5개 선택
4. 자동 계산: 8 + 10 + (5×10) = 68점 → Potential 확인
5. 체크리스트 2개 더 추가 → 88점 → Serious 확인

### 테스트 5: 양방향 동기화
1. Recruit에서 이름, 전공, 직업 변경
2. Member 탭에서 동일 필드가 업데이트되었는지 확인
3. Member에서 관계, 회사 변경
4. Recruit 탭에서 동일 필드가 업데이트되었는지 확인

## 📁 관련 파일
- `app.js`: 핵심 로직 구현 (onScoreChange, watch 함수들)
- `index.html`: UI 및 이벤트 바인딩
- `style.css`: 시각적 스타일 정의

## 🎉 완료된 작업
- ✅ 자동 등급 계산 (Potential ≥60, Serious ≥85)
- ✅ Recruit-Member 양방향 동기화
- ✅ 모든 필드 실시간 동기화
- ✅ 기본성향 평가 시스템 통합
- ✅ 클릭으로 정식 멤버 승급 기능
- ✅ 삭제 시 양방향 연동
- ✅ 트리 시각화 (점선 테두리)

---
**작성일**: 2026년 4월 22일
**버전**: 1.0
