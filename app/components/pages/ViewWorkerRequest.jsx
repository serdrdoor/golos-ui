import React from 'react';
import golos from 'golos-classic-js';
import tt from 'counterpart';

import {
    APP_DOMAIN
} from 'app/client_config';
import Button from 'app/components/elements/Button';
import TimeAgoWrapper from 'app/components/elements/TimeAgoWrapper';
import Author from 'app/components/elements/Author';
import PercentSelect from 'app/components/elements/PercentSelect';
import DropdownMenu from 'app/components/elements/DropdownMenu';
import { formatAsset, ERR } from 'app/utils/ParsersAndFormatters';

export default class ViewWorkerRequest extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      request: {post: {title: "Loading..."}, required_amount_min: '0.000 GOLOS', required_amount_max: '0.000 GOLOS' },
      myPlanningVote: 10000,
      myVote: 0,
      total_vesting_shares: 1,
      votes: []
    };
  }

  async componentDidMount() {
    const { author, permlink } = this.props;
    const query = {
      limit: 1,
      start_author: author,
      start_permlink: permlink
    };
    const requests = await golos.api.getWorkerRequestsAsync(query, 'by_created', true);
    if (!requests.length) return;
    let dgp = await golos.api.getDynamicGlobalPropertiesAsync();
    let total_vesting_shares = parseInt(dgp.total_vesting_shares.split(' ')[0].replace('.', ''));
    this.setState({
      request: requests[0],
      total_vesting_shares
    }, () => {
      this.loadVotes();
    });
  }

  componentWillUnmount() {
  }

  loadVotes = () => {
    const { author, permlink } = this.props;
    golos.api.getWorkerRequestVotes(author, permlink, '', 20, (err, votes) => {
      this.setState({
        votes
      }, () => {
        this.loadMyVote();
      });
    });
  }

  loadMyVote = () => {
    const { auth, author, permlink } = this.props;
    golos.api.getWorkerRequestVotes(author, permlink, auth.account, 1, (err, myVote) => {
      if (!myVote.length || myVote[0].voter !== auth.account) return;
      this.setState({
        myVote: myVote[0].vote_percent,
        myPlanningVote: Math.abs(myVote[0].vote_percent)
      });
    });
  }

  deleteMe = (event) => {
    event.preventDefault();
    const { auth } = this.props;
    const { request } = this.state;

    golos.broadcast.workerRequestDelete(auth.posting_key, request.post.author, request.post.permlink, [],
      (err, result) => {
        if (err) {
          alert(ERR(err, 'worker_request_delete'));
          return;
        }
        this.setState({
          request: {post: {title: "Loading..."}, required_amount_min: '0.000 GOLOS', required_amount_max: '0.000 GOLOS' }
        }, () => {
          this.props.hider('deleted');
        });
      });
  }

  editMe = (event) => {
    event.preventDefault();
    this.props.hider('edit');
  }

  onPlanningVote = (event) => {
    this.setState({
      myPlanningVote: event.target.value
    });
  }

  setVote = (percent) => {
    const { auth } = this.props;
    const { request } = this.state;
    golos.broadcast.workerRequestVote(auth.posting_key, auth.account, request.post.author, request.post.permlink,
      percent, [], (err, result) => {
        if (err) {
          alert(ERR(err, 'worker_request_vote'));
          return;
        }
        this.setState({
          myVote: percent
        });
      });
  }

  upVote = () => {
    const { myVote, myPlanningVote } = this.state;
    if (myVote > 0) {
      this.setVote(0);
      return;
    }
    this.setVote(parseInt(myPlanningVote));
  }

  downVote = () => {
    const { myVote, myPlanningVote } = this.state;
    if (myVote < 0) {
      this.setVote(0);
      return;
    }
    this.setVote(-myPlanningVote);
  }

  render() {
    const { auth } = this.props;
    const { request, myVote, myPlanningVote, votes } = this.state;

    let vote_end = null;
    if (request.state === 'created') {
      vote_end = (<span>Окончание голосования: <TimeAgoWrapper date={request.vote_end_time} altText="окончено" /></span>);
    }

    let rshares_pct = parseInt(request.stake_rshares * 100 / request.stake_total);
    rshares_pct = !isNaN(rshares_pct) ? rshares_pct : 0;

    let global_rshares_pct = parseInt(request.stake_total * 100 / this.state.total_vesting_shares);
    global_rshares_pct = !isNaN(global_rshares_pct) ? global_rshares_pct : 0;

    let upvotes = request.upvotes;
    let downvotes = request.downvotes;

    let modified_info = null;
    if (request.modified !== '1970-01-01T00:00:00') {
      modified_info = (
        <span>&nbsp;(изменено <TimeAgoWrapper date={request.modified} />)</span>
      );
    }

    let edit_button = null;
    if (request.state === 'created' && upvotes === 0 && downvotes === 0) {
      edit_button = (<a onClick={this.editMe}>Изменить</a>);
    }

    let author_menu = null;
    if (request.post.author === auth.account) {
      author_menu = (
        <div className="Request__Footer_right">
          {edit_button}
          &nbsp;
          <a onClick={this.deleteMe}>Удалить</a>
        </div>
      );
    }

    let vote_list = votes.map(vote => {
      const { voter, vote_percent } = vote;
      const sign = Math.sign(vote_percent);
      const voterPercent = vote_percent / 100 + '%';
      return {value: (sign > 0 ? '+ ' : '- ') + voter, link: 'https://golos.id/@' + voter, data: voterPercent};
    });
    let vote_more = (upvotes+downvotes) - 20;
    if (vote_more > 0) {
      vote_list.push({value: <span>{'...и ещё ' + vote_more}</span>});
    }

    return(
      <div>
        <h3><a target="_blank" href={"https://" + APP_DOMAIN + "/@" + request.post.author + "/" + request.post.permlink} rel="noopener noreferrer">
          {request.post.title}
        </a></h3>
        <p>
          Автор заявки: <Author link={request.post.author} /><br/>
          Воркер: <Author link={request.worker} />
        </p>
        <p>
          Минимальная сумма: {formatAsset(request.required_amount_min)}<br/>
          Желаемая сумма: {formatAsset(request.required_amount_max)}<br/>
          Выплата в Силу Голоса: {request.vest_reward ? "да" : "нет"}
        </p>
        <p>
          Статус заявки: {tt("workers."+request.state)}<br/>
          {vote_end}
        </p>
        <p>
          % голосов "за" от отданной СГ: {rshares_pct}%<br/>
          % голосов от общей СГ: {global_rshares_pct}%
        </p>
        <div>
          <div className="Request__Footer_left">
            <TimeAgoWrapper date={request.created} />&nbsp;<Author link={request.post.author} />{modified_info}
            <div>
              <PercentSelect className="inline" value={myPlanningVote} disabled={myVote !== 0} onChange={this.onPlanningVote} />&nbsp;
              &nbsp;
              <Button round="true" type={myVote > 0 ? "primary" : "secondary"} onClick={this.upVote}>За ({upvotes})</Button>
              &nbsp;
              <Button round="true" type={myVote < 0 ? "primary" : "secondary"} onClick={this.downVote}>Против ({downvotes})</Button>
              &nbsp;
              <DropdownMenu className="VoteList above" items={vote_list} selected={upvotes+downvotes + " голосов"} el="span" />
            </div>
          </div>
          {author_menu}
        </div>
      </div>
    );
  }
}
