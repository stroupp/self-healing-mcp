import React, { useState } from 'react';

export function App() {
  const [sourceAccount, setSourceAccount] = useState('checking');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [confirmation, setConfirmation] = useState('');

  function submitTransfer(event) {
    event.preventDefault();
    setConfirmation(`Transfer of ${amount} TRY to ${recipient} was submitted from ${sourceAccount}.`);
  }

  return (
    <main className="page" data-test-id="transfer-page">
      <section className="panel" data-test-id="transfer-form-panel">
        <h1>Money Transfer</h1>
        <form onSubmit={submitTransfer}>
          <label>
            Source account
            <select
              data-test-id="source-account-select"
              value={sourceAccount}
              onChange={(event) => setSourceAccount(event.target.value)}
            >
              <option value="checking">Checking account</option>
              <option value="savings">Savings account</option>
            </select>
          </label>

          <label>
            Recipient
            <input
              data-test-id="recipient-name-input"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder="Recipient name"
            />
          </label>

          <label>
            Amount
            <input
              data-test-id="transfer-amount-input"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="100"
            />
          </label>

          <button data-test-id="transfer-submit-button" type="submit">
            Submit transfer
          </button>
        </form>
      </section>

      {confirmation && (
        <section className="confirmation" data-test-id="transfer-confirmation-panel">
          <h2>Transfer submitted</h2>
          <p data-test-id="transfer-confirmation-message">{confirmation}</p>
        </section>
      )}
    </main>
  );
}

